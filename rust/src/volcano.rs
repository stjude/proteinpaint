// Server-side volcano plot renderer.
//
// Reads all DA rows + significance thresholds + render params on stdin (JSON),
// rasterizes the full scatter to a base64 PNG, and in the same pass emits the
// threshold-passing rows back sorted ascending by the chosen p-value column.
// This makes the Rust pass the single source of truth for both the colored
// dots in the PNG and the interactive top-significant overlay on the client.

use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use plotters::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::error::Error;
use std::io::{self, Read};
use tiny_skia::{Paint, PathBuilder, Pixmap, Stroke, Transform};

#[derive(Deserialize)]
struct Input {
    /// DA rows; each must carry fold_change + original_p_value + adjusted_p_value.
    /// Route-specific extras (gene_name, promoter_id, etc.) are preserved via Value.
    rows: Vec<Value>,
    /// "adjusted" or "original" — which p-value column to threshold and sort by.
    p_value_type: String,
    /// Cutoff on the -log10 scale.
    p_value_cutoff: f64,
    /// Log2 fold-change magnitude cutoff.
    fold_change_cutoff: f64,
    pixel_width: u32,
    pixel_height: u32,
    color_significant: String,
    color_significant_up: Option<String>,
    color_significant_down: Option<String>,
    color_nonsignificant: String,
    dot_radius: f64,
    /// Optional cap on the returned `dots`. The PNG still shows every row;
    /// only the overlay list is truncated to the most-significant N.
    #[serde(default)]
    max_interactive_dots: Option<usize>,
    /// Hi-DPI scale factor (e.g. 2.0 on retina). Defaults to 1.0 when absent
    /// so existing callers don't change behavior. The PNG is rasterized at
    /// `(pixel_* + pad) * dpr` device pixels and is rendered at the CSS-space
    /// dimensions reported in `plot_extent.pixel_*` — the browser uses the
    /// extra resolution for sharpness on hi-DPI displays. Mirror of
    /// manhattan_plot.rs's `device_pixel_ratio` handling.
    #[serde(default)]
    device_pixel_ratio: Option<f64>,
}

#[derive(Serialize)]
struct PlotExtent {
    /// Padded data extents — used to position overlay dots so points near the
    /// real-data edge stay fully visible (mirror of manhattan's yPlot domain).
    x_min: f64,
    x_max: f64,
    y_min: f64,
    y_max: f64,
    /// Unpadded data extents — used for the visible axis labels/ticks so the
    /// axis only spans the real data region (mirror of manhattan's yAxisScale).
    x_min_unpadded: f64,
    x_max_unpadded: f64,
    y_min_unpadded: f64,
    y_max_unpadded: f64,
    /// Dot radius in pixels (echoed back so the client can size overlay rings
    /// to match the PNG without recomputing the heuristic).
    dot_radius_px: f64,
    pixel_width: u32,
    pixel_height: u32,
    /// Inner drawing rect inside the PNG. Client overlay circles are
    /// positioned against this rect, not the full canvas.
    plot_left: i32,
    plot_top: i32,
    plot_right: i32,
    plot_bottom: i32,
    /// Smallest non-zero p observed; rows with p==0 were positioned at
    /// -log10(min_nonzero_p) so the client must reuse this cap to align.
    min_nonzero_p: f64,
}

#[derive(Serialize)]
struct Output {
    png: String,
    plot_extent: PlotExtent,
    /// Threshold-passing rows, sorted asc by the chosen p-value column. These
    /// are the only rows sent back — the PNG carries every row.
    dots: Vec<Value>,
    /// Total rows rendered into the PNG; used client-side for stats.
    total_rows: usize,
    /// Total rows that passed the significance thresholds, before any
    /// `max_interactive_dots` truncation. Use this for "% significant" stats.
    total_significant_rows: usize,
}

fn rgb(hex: &str, fallback: (u8, u8, u8)) -> RGBColor {
    let h = hex.trim_start_matches('#');
    let parse = |i: usize| u8::from_str_radix(&h.get(i..i + 2).unwrap_or(""), 16).ok();
    match (h.len(), parse(0), parse(2), parse(4)) {
        (6, Some(r), Some(g), Some(b)) => RGBColor(r, g, b),
        _ => RGBColor(fallback.0, fallback.1, fallback.2),
    }
}

struct Point {
    idx: usize,
    fc: f64,
    /// raw p-value (used for sorting)
    p: f64,
    /// -log10(p) with p==0 capped to min_nonzero_p
    y: f64,
    significant: bool,
}

fn main() -> Result<(), Box<dyn Error>> {
    let mut buf = String::new();
    io::stdin().read_to_string(&mut buf)?;
    let input: Input = serde_json::from_str(&buf)?;

    let p_field = match input.p_value_type.as_str() {
        "adjusted" => "adjusted_p_value",
        "original" => "original_p_value",
        other => return Err(format!("invalid p_value_type: {other}").into()),
    };

    // One pass: pull numeric summaries and find the smallest non-zero p so we
    // can cap y for rows with p == 0 (matching the client behavior).
    let mut points: Vec<Point> = Vec::with_capacity(input.rows.len());
    let mut min_nonzero_p = f64::INFINITY;
    for (idx, row) in input.rows.iter().enumerate() {
        let fc = row
            .get("fold_change")
            .and_then(|v| v.as_f64())
            .ok_or_else(|| format!("row {idx} missing numeric fold_change"))?;
        if !fc.is_finite() {
            return Err(format!("row {idx} fold_change is not finite ({fc})").into());
        }
        let p = row
            .get(p_field)
            .and_then(|v| v.as_f64())
            .ok_or_else(|| format!("row {idx} missing numeric {p_field}"))?;
        if !p.is_finite() || p < 0.0 {
            return Err(format!("row {idx} {p_field} must be a finite value >= 0 (got {p})").into());
        }
        if p > 0.0 && p < min_nonzero_p {
            min_nonzero_p = p;
        }
        points.push(Point {
            idx,
            fc,
            p,
            y: 0.0,
            significant: false,
        });
    }
    if !min_nonzero_p.is_finite() {
        min_nonzero_p = 1e-300;
    }

    // Classify + compute y; track axis extents in the same pass.
    let (mut x_abs_max, mut y_max_data) = (0f64, 0f64);
    for pt in points.iter_mut() {
        let p_for_y = if pt.p <= 0.0 { min_nonzero_p } else { pt.p };
        pt.y = -p_for_y.log10();
        pt.significant = pt.y > input.p_value_cutoff && pt.fc.abs() > input.fold_change_cutoff;
        x_abs_max = x_abs_max.max(pt.fc.abs());
        y_max_data = y_max_data.max(pt.y);
    }

    // Unpadded axis extents — symmetric on x, raw data bounds. The dot-radius
    // pad below provides pixel-level headroom so we don't need extra data-range
    // breathing room (mirrors manhattan_plot.rs's tighter feel). Fallback to 1.0
    // when the data has zero spread to keep the chart range valid.
    let x_span = if x_abs_max > 0.0 { x_abs_max } else { 1.0 };
    let (x_min_unpadded, x_max_unpadded) = (-x_span, x_span);
    let y_min_unpadded = 0f64;
    let y_max_unpadded = if y_max_data > 0.0 { y_max_data } else { 1.0 };

    // Normalize the dot radius once into the integer pixel count plotters will
    // actually draw, with a min of 1 so sub-pixel inputs don't collapse to a
    // zero-radius dot. This single value drives both PNG padding and circle
    // rendering, keeping the geometry self-consistent (matches manhattan).
    let radius_px = (input.dot_radius as i32).max(1);
    // Pad PNG by 2*radius_px so dots near the data edges stay fully visible.
    let pad_px = (2 * radius_px) as u32;
    let (w, h) = (input.pixel_width + pad_px, input.pixel_height + pad_px);
    if w == 0 || h == 0 || w > 4000 || h > 4000 {
        return Err(format!("pixel dimensions {}x{} out of range (1–4000)", w, h).into());
    }

    // Convert pixel padding to data units using the unpadded extents and the
    // unpadded pixel dimensions. Per-axis pad in data space = radius_px * (data
    // range / pixel range) — keeps the data/pixel ratio identical between
    // padded and unpadded space.
    let x_data_per_px = (x_max_unpadded - x_min_unpadded) / input.pixel_width as f64;
    let y_data_per_px = (y_max_unpadded - y_min_unpadded) / input.pixel_height as f64;
    let x_pad_data = radius_px as f64 * x_data_per_px;
    let y_pad_data = radius_px as f64 * y_data_per_px;
    let x_min = x_min_unpadded - x_pad_data;
    let x_max = x_max_unpadded + x_pad_data;
    let y_min = y_min_unpadded - y_pad_data;
    let y_max = y_max_unpadded + y_pad_data;

    // Hi-DPR scaling. The buffer/chart are sized in device pixels (CSS * dpr)
    // and the drawn radius/stroke are scaled the same way, so the PNG is
    // sharper on retina. backend_coord returns device-pixel coords; we divide
    // by dpr below to keep `pixel_x/pixel_y` in CSS-space (which is what the
    // SVG overlay coordinate system uses). Mirror of manhattan_plot.rs.
    let dpr = input.device_pixel_ratio.unwrap_or(1.0).max(1.0);
    let w_hd = ((w as f64) * dpr) as u32;
    let h_hd = ((h as f64) * dpr) as u32;

    let mut buffer = vec![0u8; (w_hd as usize) * (h_hd as usize) * 3];
    // Per-point pixel coords as plotters' chart maps them. Captured in device
    // pixels so tiny-skia can draw the AA rings exactly at those positions;
    // we keep a CSS-space copy below for the SVG overlay.
    let mut pixel_coords_hd: Vec<(f64, f64)> = Vec::with_capacity(points.len());
    {
        let backend = BitMapBackend::with_buffer(&mut buffer, (w_hd, h_hd));
        let root = backend.into_drawing_area();
        root.fill(&WHITE)?;

        let mut chart = ChartBuilder::on(&root)
            .margin(0)
            .set_all_label_area_size(0)
            .build_cartesian_2d(x_min..x_max, y_min..y_max)?;
        chart
            .configure_mesh()
            .disable_x_mesh()
            .disable_y_mesh()
            .disable_axes()
            .draw()?;

        // Threshold guide lines are drawn by the SVG overlay on the client, not
        // here — double-drawing them would add stray lines offset by axis padding.
        // The dots themselves are drawn below with tiny-skia for true AA; here
        // plotters just gives us a white-background buffer and the data-to-pixel
        // mapping. Mirror of manhattan_plot.rs.

        for p in points.iter() {
            let (px, py) = chart.backend_coord(&(p.fc, p.y));
            pixel_coords_hd.push((px as f64, py as f64));
        }

        root.present()?;
    }

    // Convert plotters' RGB buffer to a tiny-skia RGBA pixmap, then stroke the
    // dots on top with anti-aliasing — gives crisp rings even when the user
    // zooms in past native DPR. Plotters' BitMapBackend has no AA on shapes,
    // which is why ring edges looked chunky before this rewrite.
    let mut pixmap = Pixmap::new(w_hd, h_hd).ok_or("failed to create pixmap")?;
    {
        let data = pixmap.data_mut();
        for (src, dst) in buffer.chunks_exact(3).zip(data.chunks_exact_mut(4)) {
            dst[..3].copy_from_slice(src);
            dst[3] = 255;
        }
    }

    // Resolve colors once. Up/down fall back to `color_sig` when absent.
    let color_sig = rgb(&input.color_significant, (214, 39, 40));
    let color_non = rgb(&input.color_nonsignificant, (0, 0, 0));
    let resolve = |o: &Option<String>| o.as_deref().map(|s| rgb(s, (214, 39, 40))).unwrap_or(color_sig);
    let color_up = resolve(&input.color_significant_up);
    let color_down = resolve(&input.color_significant_down);

    let radius_hd_f = radius_px as f32 * dpr as f32;
    // 1 CSS-pixel-wide stroke at hi-DPR. The stroke straddles the path, so the
    // visible ring thickness is `stroke_width` device px ≈ 1 CSS px.
    let mut stroke = Stroke::default();
    stroke.width = dpr as f32;
    let mut paint = Paint::default();
    paint.anti_alias = true;

    let stroke_ring = |pixmap: &mut Pixmap, paint: &mut Paint, color: RGBColor, px: f32, py: f32| {
        paint.set_color_rgba8(color.0, color.1, color.2, 255);
        let mut pb = PathBuilder::new();
        pb.push_circle(px, py, radius_hd_f);
        if let Some(path) = pb.finish() {
            pixmap.stroke_path(&path, paint, &stroke, Transform::identity(), None);
        }
    };

    // Draw non-significant first so significant rings overlay on top.
    for (i, p) in points.iter().enumerate() {
        if p.significant {
            continue;
        }
        let (px, py) = pixel_coords_hd[i];
        stroke_ring(&mut pixmap, &mut paint, color_non, px as f32, py as f32);
    }
    for (i, p) in points.iter().enumerate() {
        if !p.significant {
            continue;
        }
        let (px, py) = pixel_coords_hd[i];
        let c = if p.fc > 0.0 { color_up } else { color_down };
        stroke_ring(&mut pixmap, &mut paint, c, px as f32, py as f32);
    }

    // CSS-space coords for the SVG overlay — divide the device-pixel positions
    // by dpr. The overlay does not know about hi-DPR; the PNG sizing handles
    // sharpness for us.
    let all_pixel_coords: Vec<(f64, f64)> = pixel_coords_hd.iter().map(|(x, y)| (x / dpr, y / dpr)).collect();

    // Build the interactive `dots` list: threshold-passers sorted asc by the
    // chosen p-value column, optionally capped at `max_interactive_dots`.
    let mut sig_points: Vec<&Point> = points.iter().filter(|p| p.significant).collect();
    sig_points.sort_by(|a, b| a.p.partial_cmp(&b.p).unwrap_or(std::cmp::Ordering::Equal));
    let total_significant_rows = sig_points.len();
    if let Some(cap) = input.max_interactive_dots {
        sig_points.truncate(cap);
    }
    let dots: Vec<Value> = sig_points
        .iter()
        .map(|p| {
            let mut row = input.rows[p.idx].clone();
            let (px, py) = all_pixel_coords[p.idx];
            if let Value::Object(ref mut m) = row {
                m.insert("pixel_x".to_string(), Value::from(px));
                m.insert("pixel_y".to_string(), Value::from(py));
            }
            row
        })
        .collect();

    let output = Output {
        png: BASE64.encode(&pixmap.encode_png()?),
        plot_extent: PlotExtent {
            x_min,
            x_max,
            y_min,
            y_max,
            x_min_unpadded,
            x_max_unpadded,
            y_min_unpadded,
            y_max_unpadded,
            // Echo the normalized integer radius plotters actually drew so the
            // SVG overlay sizes its rings to match the rasterized PNG dots.
            dot_radius_px: radius_px as f64,
            pixel_width: w,
            pixel_height: h,
            plot_left: 0,
            plot_top: 0,
            plot_right: w as i32,
            plot_bottom: h as i32,
            min_nonzero_p,
        },
        dots,
        total_rows: input.rows.len(),
        total_significant_rows,
    };

    println!("{}", serde_json::to_string(&output)?);
    Ok(())
}
