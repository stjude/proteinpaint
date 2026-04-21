// Server-side volcano plot renderer.
//
// Reads all DA rows + significance thresholds + render params on stdin (JSON),
// rasterizes the full scatter to a base64 PNG, and in the same pass emits the
// threshold-passing rows back sorted ascending by the chosen p-value column.
// This makes the Rust pass the single source of truth for both the colored
// dots in the PNG and the interactive top-significant overlay on the client.

use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use plotters::prelude::*;
use plotters::style::ShapeStyle;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::error::Error;
use std::io::{self, Read};

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
}

#[derive(Serialize)]
struct PlotExtent {
    x_min: f64,
    x_max: f64,
    y_min: f64,
    y_max: f64,
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
        let p = row
            .get(p_field)
            .and_then(|v| v.as_f64())
            .ok_or_else(|| format!("row {idx} missing numeric {p_field}"))?;
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

    // Axis extents — symmetric on x, padded 5%.
    let x_span = if x_abs_max > 0.0 { x_abs_max * 1.05 } else { 1.0 };
    let (x_min, x_max, y_min) = (-x_span, x_span, 0f64);
    let y_max = if y_max_data > 0.0 { y_max_data * 1.05 } else { 1.0 };

    // Render — borderless scatter. No axes/labels/margins. The client owns
    // axes and positions the PNG exactly over its plot rect, so the inner
    // drawing area fills the whole canvas.
    let (w, h) = (input.pixel_width, input.pixel_height);
    let mut buffer = vec![0u8; (w as usize) * (h as usize) * 3];
    {
        let backend = BitMapBackend::with_buffer(&mut buffer, (w, h));
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

        // Threshold guide lines: horizontal p-value cutoff + vertical ±fc cutoff.
        let guide = ShapeStyle {
            color: RGBColor(170, 170, 170).mix(0.6),
            filled: false,
            stroke_width: 1,
        };
        if input.p_value_cutoff > y_min && input.p_value_cutoff < y_max {
            chart.draw_series(std::iter::once(PathElement::new(
                vec![(x_min, input.p_value_cutoff), (x_max, input.p_value_cutoff)],
                guide.clone(),
            )))?;
        }
        if input.fold_change_cutoff > 0.0 {
            for fc in [-input.fold_change_cutoff, input.fold_change_cutoff] {
                if fc > x_min && fc < x_max {
                    chart.draw_series(std::iter::once(PathElement::new(
                        vec![(fc, y_min), (fc, y_max)],
                        guide.clone(),
                    )))?;
                }
            }
        }

        // Resolve colors once. Up/down fall back to `color_sig` when absent.
        let color_sig = rgb(&input.color_significant, (214, 39, 40));
        let color_non = rgb(&input.color_nonsignificant, (0, 0, 0));
        let resolve = |o: &Option<String>| o.as_deref().map(|s| rgb(s, (214, 39, 40))).unwrap_or(color_sig);
        let color_up = resolve(&input.color_significant_up);
        let color_down = resolve(&input.color_significant_down);

        // Stroke-only rings at full opacity so each ring is the exact configured
        // group color — matching the hue the SVG overlay uses.
        let ring = |c: RGBColor| ShapeStyle {
            color: c.into(),
            filled: false,
            stroke_width: 1,
        };
        let radius = input.dot_radius as i32;

        // Draw non-significant first so significant rings overlay on top.
        chart.draw_series(
            points
                .iter()
                .filter(|p| !p.significant)
                .map(|p| Circle::new((p.fc, p.y), radius, ring(color_non))),
        )?;
        chart.draw_series(points.iter().filter(|p| p.significant).map(|p| {
            let c = if p.fc > 0.0 { color_up } else { color_down };
            Circle::new((p.fc, p.y), radius, ring(c))
        }))?;

        root.present()?;
    }

    // Build the interactive `dots` list: threshold-passers sorted asc by the
    // chosen p-value column, optionally capped at `max_interactive_dots`.
    let mut sig_points: Vec<&Point> = points.iter().filter(|p| p.significant).collect();
    sig_points.sort_by(|a, b| a.p.partial_cmp(&b.p).unwrap_or(std::cmp::Ordering::Equal));
    if let Some(cap) = input.max_interactive_dots {
        sig_points.truncate(cap);
    }
    let dots: Vec<Value> = sig_points.iter().map(|p| input.rows[p.idx].clone()).collect();

    let output = Output {
        png: BASE64.encode(&encode_rgb_to_png(&buffer, w, h)?),
        plot_extent: PlotExtent {
            x_min,
            x_max,
            y_min,
            y_max,
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
    };

    println!("{}", serde_json::to_string(&output)?);
    Ok(())
}

/// Convert a plotters RGB buffer (3 bytes/px) to a PNG via tiny-skia (4 bytes/px).
fn encode_rgb_to_png(rgb: &[u8], w: u32, h: u32) -> Result<Vec<u8>, Box<dyn Error>> {
    let mut pixmap = tiny_skia::Pixmap::new(w, h).ok_or("failed to create pixmap")?;
    for (src, dst) in rgb.chunks_exact(3).zip(pixmap.data_mut().chunks_exact_mut(4)) {
        dst[..3].copy_from_slice(src);
        dst[3] = 255;
    }
    Ok(pixmap.encode_png()?)
}
