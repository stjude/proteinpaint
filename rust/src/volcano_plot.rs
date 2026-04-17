use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use plotters::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json;
use std::error::Error;
use std::io;
use tiny_skia::{PathBuilder, Pixmap, Stroke, Transform};

// Input from stdin as JSON
#[derive(Deserialize, Debug)]
struct Input {
    #[serde(rename = "type")]
    plot_type: String,
    points: Vec<InputPoint>,
    plot_width: u64,
    plot_height: u64,
    device_pixel_ratio: f64,
    png_dot_radius: u64,
    fold_change_cutoff: f64,
    p_value_cutoff: f64,
    /// "adjusted" or "original"
    p_value_type: String,
    /// Max number of points to return with pixel coordinates for client-side
    /// interactivity. All points are rendered in the PNG; only the top N get
    /// hover/click support.
    top_n: usize,
    color_significant_up: String,
    color_significant_down: String,
    color_nonsignificant: String,
    /// Stroke width (CSS px) for non-significant circles. Default 1.0.
    #[serde(default = "default_stroke_width_nonsig")]
    stroke_width_nonsignificant: f32,
    /// Stroke width (CSS px) for significant circles. Default 1.5.
    #[serde(default = "default_stroke_width_sig")]
    stroke_width_significant: f32,
    /// Alpha (0-255) for non-significant circle strokes. Default 51 (~0.2).
    #[serde(default = "default_stroke_alpha_nonsig")]
    stroke_alpha_nonsignificant: u8,
    /// Alpha (0-255) for significant circle strokes. Default 89 (~0.35).
    #[serde(default = "default_stroke_alpha_sig")]
    stroke_alpha_significant: u8,
}

fn default_stroke_width_nonsig() -> f32 {
    1.0
}
fn default_stroke_width_sig() -> f32 {
    1.5
}
fn default_stroke_alpha_nonsig() -> u8 {
    51
}
fn default_stroke_alpha_sig() -> u8 {
    89
}

#[derive(Deserialize, Debug, Clone)]
struct InputPoint {
    gene: String,
    /// log2 fold change
    log2_fold_change: f64,
    original_p_value: f64,
    adjusted_p_value: f64,
    /// Optional promoter id used by DNA methylation volcano
    #[serde(default)]
    promoter_id: Option<String>,
}

#[derive(Serialize)]
struct PointDetail {
    gene: String,
    promoter_id: Option<String>,
    log2_fold_change: f64,
    original_p_value: f64,
    adjusted_p_value: f64,
    neg_log10_p: f64,
    significant: bool,
    color: String,
    pixel_x: f64,
    pixel_y: f64,
}

#[derive(Serialize)]
struct PlotData {
    /// Top N interactive points (filtered by fold change cutoff, sorted by
    /// -log10(p_value) descending). Clients use pixel_x/pixel_y for quadtree
    /// hit detection.
    points: Vec<PointDetail>,
    x_min: f64,
    x_max: f64,
    y_min: f64,
    y_max: f64,
    device_pixel_ratio: f64,
    /// Number of total points rendered in the PNG
    total_points: usize,
    /// Number of significant points (passing both p and fold change cutoffs)
    num_significant: usize,
}

#[derive(Serialize)]
struct Output {
    png: String,
    plot_data: PlotData,
}

// Convert "#rrggbb" to (r, g, b). Returns gray if malformed.
fn hex_to_rgb(hex: &str) -> (u8, u8, u8) {
    let hex = hex.trim_start_matches('#');
    if hex.len() != 6 {
        return (136, 136, 136);
    }
    let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(136);
    let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(136);
    let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(136);
    (r, g, b)
}

fn plot_volcano(input: &Input) -> Result<(String, PlotData), Box<dyn Error>> {
    let use_adjusted = input.p_value_type == "adjusted";

    // -------------------------------------------------------------
    // 1. Compute derived values per point: -log10(p), significance, color.
    //    p=0 points can't be log-transformed; mark them and cap to max_y
    //    after we've found max from non-zero p-values. Matches master's
    //    VolcanoViewModel behavior and the grin2 "clamp zero to top" trick.
    // -------------------------------------------------------------
    struct ComputedPoint<'a> {
        src: &'a InputPoint,
        neg_log10_p: f64,
        is_zero_p: bool,
        significant: bool,
        color: String,
    }

    let mut computed: Vec<ComputedPoint> = Vec::with_capacity(input.points.len());
    for p in &input.points {
        let pv = if use_adjusted {
            p.adjusted_p_value
        } else {
            p.original_p_value
        };
        let is_zero_p = pv <= 0.0;
        // Placeholder for zero-p points; overwritten with max_y after pass 2.
        let neg_log10_p = if is_zero_p { 0.0 } else { -(pv.log10()) };

        let passes_p = is_zero_p || neg_log10_p > input.p_value_cutoff;
        let passes_fc = p.log2_fold_change.abs() > input.fold_change_cutoff;
        let significant = passes_p && passes_fc;

        let color = if significant {
            if p.log2_fold_change > 0.0 {
                input.color_significant_up.clone()
            } else {
                input.color_significant_down.clone()
            }
        } else {
            input.color_nonsignificant.clone()
        };

        computed.push(ComputedPoint {
            src: p,
            neg_log10_p,
            is_zero_p,
            significant,
            color,
        });
    }

    // -------------------------------------------------------------
    // 2. Determine plot axis ranges from actual data min/max. Matches the
    //    old client behavior (VolcanoViewModel uses [minFoldChange,
    //    maxFoldChange] directly). p=0 points are excluded from max_y and
    //    then clamped to max_y so they cluster at the top of the plot.
    // -------------------------------------------------------------
    let mut min_fc: f64 = f64::INFINITY;
    let mut max_fc: f64 = f64::NEG_INFINITY;
    let mut max_y: f64 = 0.0;
    for c in &computed {
        if c.src.log2_fold_change < min_fc {
            min_fc = c.src.log2_fold_change;
        }
        if c.src.log2_fold_change > max_fc {
            max_fc = c.src.log2_fold_change;
        }
        if !c.is_zero_p && c.neg_log10_p > max_y {
            max_y = c.neg_log10_p;
        }
    }
    if !min_fc.is_finite() {
        min_fc = -1.0;
    }
    if !max_fc.is_finite() {
        max_fc = 1.0;
    }
    if max_y == 0.0 {
        max_y = 1.0;
    }
    // Clamp p=0 points to max_y (top of plot) so they render with real data
    // instead of being scattered above/below based on a synthetic placeholder.
    for c in computed.iter_mut() {
        if c.is_zero_p {
            c.neg_log10_p = max_y;
        }
    }

    let num_significant = computed.iter().filter(|c| c.significant).count();

    let x_min = min_fc;
    let x_max = max_fc;
    let y_min = 0.0;
    let y_max = max_y;

    // -------------------------------------------------------------
    // 3. Setup high-DPR bitmap
    // -------------------------------------------------------------
    let dpr = input.device_pixel_ratio.max(1.0);
    // PNG is padded by dot_radius on each side so dots at the very edges of
    // the data range render fully (not half-clipped). The chart's plot area
    // is inset by the same amount (via margin), so data coord x_min maps to
    // pixel x = dot_radius, x_max maps to pixel x = png_width - dot_radius.
    // On the client the PNG is positioned with its inner area aligned to the
    // SVG plot rect, so the dot overflow extends visibly beyond the rect.
    let png_width = input.plot_width + 2 * input.png_dot_radius;
    let png_height = input.plot_height + 2 * input.png_dot_radius;
    let w: u32 = ((png_width as f64) * dpr) as u32;
    let h: u32 = ((png_height as f64) * dpr) as u32;

    let mut buffer = vec![0u8; w as usize * h as usize * 3];
    let mut pixel_positions: Vec<(f64, f64)> = Vec::with_capacity(computed.len());

    {
        let backend = BitMapBackend::with_buffer(&mut buffer, (w, h));
        let root = backend.into_drawing_area();
        root.fill(&WHITE)?;

        // Chart with no axes (client overlays SVG axes). Use a margin equal
        // to png_dot_radius (in logical px, scaled by dpr) so the data area
        // is inset, leaving room for edge dots to render fully.
        let chart_margin = (input.png_dot_radius as f64 * dpr) as i32;
        let mut chart = ChartBuilder::on(&root)
            .margin(chart_margin)
            .set_all_label_area_size(0)
            .build_cartesian_2d(x_min..x_max, y_min..y_max)?;
        chart
            .configure_mesh()
            .disable_x_mesh()
            .disable_y_mesh()
            .disable_axes()
            .draw()?;

        // Map each data point to high-DPR pixel coordinates
        for c in &computed {
            let (px, py) = chart.backend_coord(&(c.src.log2_fold_change, c.neg_log10_p));
            pixel_positions.push((px as f64, py as f64));
        }

        root.present()?;
    }

    // -------------------------------------------------------------
    // 4. Create a transparent pixmap for the circles. Plotters was only
    //    used above for coord mapping — we discard its (white-filled) RGB
    //    buffer so the PNG background is transparent. This lets the SVG
    //    plot rect show through on the client.
    // -------------------------------------------------------------
    let _ = buffer; // keep the variable around for plotters' lifetime; unused from here
    let mut pixmap = Pixmap::new(w, h).ok_or("Failed to create pixmap")?;

    // Scale CSS pixel values (radius and stroke width) to device pixels so
    // the PNG looks consistent on high-DPR displays.
    let dpr_f32 = dpr as f32;
    let radius_high_dpr = (input.png_dot_radius as f32) * dpr_f32;
    let stroke_sig = Stroke {
        width: input.stroke_width_significant * dpr_f32,
        ..Default::default()
    };
    let stroke_nonsig = Stroke {
        width: input.stroke_width_nonsignificant * dpr_f32,
        ..Default::default()
    };
    let mut paint = tiny_skia::Paint::default();
    paint.anti_alias = true;

    // Draw non-significant first so significant points appear on top
    let mut draw_order: Vec<usize> = (0..computed.len()).collect();
    draw_order.sort_by_key(|&i| computed[i].significant as u8);

    for &i in &draw_order {
        let (px, py) = pixel_positions[i];
        let (r, g, b) = hex_to_rgb(&computed[i].color);
        let (alpha, stroke) = if computed[i].significant {
            (input.stroke_alpha_significant, &stroke_sig)
        } else {
            (input.stroke_alpha_nonsignificant, &stroke_nonsig)
        };
        paint.set_color_rgba8(r, g, b, alpha);
        let mut pb = PathBuilder::new();
        pb.push_circle(px as f32, py as f32, radius_high_dpr);
        if let Some(path) = pb.finish() {
            pixmap.stroke_path(&path, &paint, stroke, Transform::identity(), None);
        }
    }

    let png_bytes = pixmap.encode_png()?;
    let png_data = BASE64.encode(&png_bytes);

    // -------------------------------------------------------------
    // 5. Top N selection: filter by fold change cutoff, sort by -log10(p) desc
    // -------------------------------------------------------------
    let mut candidate_indices: Vec<usize> = (0..computed.len())
        .filter(|&i| computed[i].src.log2_fold_change.abs() >= input.fold_change_cutoff)
        .collect();
    candidate_indices.sort_by(|&a, &b| {
        computed[b]
            .neg_log10_p
            .partial_cmp(&computed[a].neg_log10_p)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    candidate_indices.truncate(input.top_n);

    let mut top_points: Vec<PointDetail> = Vec::with_capacity(candidate_indices.len());
    for &i in &candidate_indices {
        let (px, py) = pixel_positions[i];
        top_points.push(PointDetail {
            gene: computed[i].src.gene.clone(),
            promoter_id: computed[i].src.promoter_id.clone(),
            log2_fold_change: computed[i].src.log2_fold_change,
            original_p_value: computed[i].src.original_p_value,
            adjusted_p_value: computed[i].src.adjusted_p_value,
            neg_log10_p: computed[i].neg_log10_p,
            significant: computed[i].significant,
            color: computed[i].color.clone(),
            pixel_x: px / dpr,
            pixel_y: py / dpr,
        });
    }

    let plot_data = PlotData {
        points: top_points,
        x_min,
        x_max,
        y_min,
        y_max,
        device_pixel_ratio: dpr,
        total_points: computed.len(),
        num_significant,
    };

    Ok((png_data, plot_data))
}

fn main() -> Result<(), Box<dyn Error>> {
    let mut input = String::new();
    io::stdin().read_line(&mut input).expect("Error reading input JSON");

    let input_json: Input = serde_json::from_str(&input).expect("Invalid JSON input");

    if input_json.plot_type != "volcano" {
        panic!("Unsupported plot type: {}", input_json.plot_type);
    }

    let (png, plot_data) = plot_volcano(&input_json).expect("Failed to generate volcano plot");
    let output = Output { png, plot_data };
    println!("{}", serde_json::to_string(&output)?);
    Ok(())
}
