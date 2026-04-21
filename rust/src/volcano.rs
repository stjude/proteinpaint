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
    /// Optional cap on the number of rows returned in `data`. The PNG still
    /// shows every row; only the interactive overlay list is truncated to the
    /// most-significant N (after sorting by the chosen p-value column).
    #[serde(default)]
    max_interactive_dots: Option<usize>,
    #[serde(default = "default_x_axis_label")]
    x_axis_label: String,
    #[serde(default = "default_y_axis_label")]
    y_axis_label: String,
}

fn default_x_axis_label() -> String {
    "log2(fold change)".to_string()
}
fn default_y_axis_label() -> String {
    "-log10(p-value)".to_string()
}

#[derive(Serialize)]
struct PlotExtent {
    x_min: f64,
    x_max: f64,
    y_min: f64,
    y_max: f64,
    pixel_width: u32,
    pixel_height: u32,
    plot_left: i32,
    plot_top: i32,
    plot_right: i32,
    plot_bottom: i32,
    /// The smallest non-zero p-value observed in the input rows. Rows where
    /// `p == 0` were positioned at `-log10(min_nonzero_p)` in the PNG; the
    /// client must use the same cap so overlay circles align with their
    /// PNG counterparts.
    min_nonzero_p: f64,
}

#[derive(Serialize)]
struct Output {
    png: String,
    plot_extent: PlotExtent,
    /// Interactive dots: rows that passed the significance thresholds, sorted
    /// ascending by the chosen p-value column. These are the only rows sent
    /// back — the PNG carries the visual of every row.
    dots: Vec<Value>,
    /// Total number of rows rendered into the PNG. Lets the client compute
    /// "total" and "percent significant" stats without transmitting the full list.
    total_rows: usize,
}

fn hex_to_rgb(hex: &str) -> Option<(u8, u8, u8)> {
    let hex = hex.trim_start_matches('#');
    if hex.len() != 6 {
        return None;
    }
    let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
    let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
    let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
    Some((r, g, b))
}

fn rgb(hex: &str, fallback: (u8, u8, u8)) -> RGBColor {
    let (r, g, b) = hex_to_rgb(hex).unwrap_or(fallback);
    RGBColor(r, g, b)
}

/// One row's numeric summary used for rendering + classification.
/// `in_top_n` is set later after sorting: only these rows get the bright
/// group (case/control) color in the PNG so it visually matches the SVG
/// overlay, which also only renders the top-N. Significant rows outside
/// the top-N get rendered as non-significant so they don't overwhelm the
/// PNG with bright color where the overlay doesn't reach.
struct Point {
    idx: usize,
    fc: f64,
    /// p-value value in linear space as received (used for sorting).
    p: f64,
    /// y position on the plot (-log10 of p, with p=0 capped to min non-zero).
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

    // Extract numeric summaries once; find the smallest non-zero p so we can
    // cap y for rows with p == 0 (matching the client behavior).
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

    // Classify + compute y.
    let mut x_abs_max = 0f64;
    let mut y_max_data = 0f64;
    for pt in points.iter_mut() {
        let p_for_y = if pt.p <= 0.0 { min_nonzero_p } else { pt.p };
        pt.y = -p_for_y.log10();
        pt.significant = pt.y > input.p_value_cutoff && pt.fc.abs() > input.fold_change_cutoff;
        if pt.fc.abs() > x_abs_max {
            x_abs_max = pt.fc.abs();
        }
        if pt.y > y_max_data {
            y_max_data = pt.y;
        }
    }

    // Axis extents — symmetric on x, padded 5%.
    let x_span = if x_abs_max > 0.0 { x_abs_max * 1.05 } else { 1.0 };
    let x_min = -x_span;
    let x_max = x_span;
    let y_min = 0f64;
    let y_max = if y_max_data > 0.0 { y_max_data * 1.05 } else { 1.0 };

    // Render — borderless scatter. No axes, no labels, no margins. The client
    // owns axes and positions the PNG exactly over its plot rect, so the
    // inner drawing area fills the whole canvas (plot_left=0, plot_top=0,
    // plot_right=pixel_width, plot_bottom=pixel_height).
    let w = input.pixel_width;
    let h = input.pixel_height;
    let mut buffer = vec![0u8; (w as usize) * (h as usize) * 3];
    let plot_rect: (i32, i32, i32, i32) = (0, 0, w as i32, h as i32);
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

        // Threshold guide lines (horizontal p-value cutoff + vertical ±fc cutoff).
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

        let color_up = input.color_significant_up.as_deref().map(|s| rgb(s, (214, 39, 40)));
        let color_down = input.color_significant_down.as_deref().map(|s| rgb(s, (214, 39, 40)));
        let color_sig = rgb(&input.color_significant, (214, 39, 40));
        let color_non = rgb(&input.color_nonsignificant, (0, 0, 0));

        // Stroke-only rings at full opacity so each ring is the exact configured
        // group color — matching the hue the SVG overlay uses (the overlay then
        // paints over the top with its own stroke-opacity; letting the PNG use
        // the raw color keeps the underlying hue uniform with the overlay's).
        let ring = |c: RGBColor| ShapeStyle {
            color: c.into(),
            filled: false,
            stroke_width: 1,
        };

        // Draw non-significant first so significant rings overlay on top.
        let radius = input.dot_radius as i32;
        let non_sig_iter = points
            .iter()
            .filter(|p| !p.significant)
            .map(|p| Circle::new((p.fc, p.y), radius, ring(color_non)));
        chart.draw_series(non_sig_iter)?;

        let sig_iter = points.iter().filter(|p| p.significant).map(|p| {
            let c = if p.fc > 0.0 {
                color_up.unwrap_or(color_sig)
            } else {
                color_down.unwrap_or(color_sig)
            };
            Circle::new((p.fc, p.y), radius, ring(c))
        });
        chart.draw_series(sig_iter)?;

        root.present()?;
    }
    let _ = &input.x_axis_label; // silence unused warnings for the axis-label fields
    let _ = &input.y_axis_label; // (kept on Input for future enrichment)

    // Encode RGB buffer → PNG.
    let png_bytes = encode_rgb_to_png(&buffer, w, h)?;
    let png_base64 = BASE64.encode(&png_bytes);

    // Build the interactive `data` list: rows that passed the significance
    // thresholds, sorted ascending by the requested p-value column. Optionally
    // capped at `max_interactive_dots` (keeping only the most-significant rows)
    // so the client doesn't have to render thousands of overlay circles.
    let mut sig_points: Vec<&Point> = points.iter().filter(|p| p.significant).collect();
    sig_points.sort_by(|a, b| a.p.partial_cmp(&b.p).unwrap_or(std::cmp::Ordering::Equal));
    if let Some(cap) = input.max_interactive_dots {
        sig_points.truncate(cap);
    }
    let dots: Vec<Value> = sig_points.iter().map(|p| input.rows[p.idx].clone()).collect();

    let total_rows = input.rows.len();
    let output = Output {
        png: png_base64,
        plot_extent: PlotExtent {
            x_min,
            x_max,
            y_min,
            y_max,
            pixel_width: w,
            pixel_height: h,
            plot_left: plot_rect.0,
            plot_top: plot_rect.1,
            plot_right: plot_rect.2,
            plot_bottom: plot_rect.3,
            min_nonzero_p,
        },
        dots,
        total_rows,
    };

    println!("{}", serde_json::to_string(&output)?);
    Ok(())
}

/// Encode a raw RGB (no alpha) frame buffer to PNG using tiny-skia, which is
/// already a dependency and used by manhattan_plot.rs.
fn encode_rgb_to_png(rgb: &[u8], w: u32, h: u32) -> Result<Vec<u8>, Box<dyn Error>> {
    let mut pixmap = tiny_skia::Pixmap::new(w, h).ok_or("failed to create pixmap")?;
    let data = pixmap.data_mut();
    let mut si = 0usize;
    let mut di = 0usize;
    for _ in 0..(w as usize * h as usize) {
        data[di] = rgb[si];
        data[di + 1] = rgb[si + 1];
        data[di + 2] = rgb[si + 2];
        data[di + 3] = 255;
        si += 3;
        di += 4;
    }
    Ok(pixmap.encode_png()?)
}
