use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use plotters::prelude::*;
use plotters::style::ShapeStyle;
use serde::{Deserialize, Serialize};
use serde_json;
use std::collections::HashMap;
use std::convert::TryInto;
use std::error::Error;
use std::fs::File;
use std::io::{self, BufRead, BufReader};
use tiny_skia::{FillRule, PathBuilder, Pixmap, Transform};

// Define the JSON input structure
#[derive(Deserialize, Debug)]
struct Input {
    file: String,
    #[serde(rename = "type")]
    plot_type: String,
    #[serde(rename = "chrSizes")]
    chromosomelist: HashMap<String, u64>,
    plot_width: u64,
    plot_height: u64,
    device_pixel_ratio: f64,
    png_dot_radius: u64,
    log_cutoff: f64,
    max_capped_points: u64,
    hard_cap: f64,
    bin_size: f64,
}

// chromosome info
#[derive(Serialize)]
struct ChromInfo {
    start: u64,
    size: u64,
    center: u64,
}

#[derive(Serialize)]
struct PointDetail {
    x: u64,
    y: f64,
    color: String,
    r#type: String,
    gene: String,
    chrom: String,
    start: u64,
    end: u64,
    pos: u64,
    q_value: f64,
    nsubj: Option<i64>,
    pixel_x: f64,
    pixel_y: f64,
}

#[derive(Serialize)]
struct InteractiveData {
    points: Vec<PointDetail>,
    chrom_data: HashMap<String, ChromInfo>,
    total_genome_length: i64,
    x_buffer: i64,
    y_min: f64,
    y_max: f64,
    device_pixel_ratio: f64,
    has_capped_points: bool,
}

#[derive(Serialize)]
struct Output {
    png: String,
    plot_data: InteractiveData,
}

// Helper function to convert hex color to RGB
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

/// Calculate dynamic y-cap using fixed bin approach
///
/// Strategy:
/// 1. If max_y <= default_cap: no capping needed, return max_y
/// 2. Build histogram and walk up from lowest bin to find lowest cap where <= max_capped_points points are above it
/// 3. Never exceed hard_cap regardless of data distribution
///
/// Uses fixed bins of size 10 on the -log10 scale starting from the default cap (defined by default_cap coming from constant in manhattan.js up to hard_cap) (default_cap, 50, 60, ..., hard_cap)
fn calculate_dynamic_y_cap(
    ys: &[f64],
    default_cap: f64,
    max_capped_points: usize,
    hard_cap: f64,
    bin_size: f64,
) -> f64 {
    let num_bins = ((hard_cap - default_cap) / bin_size) as usize;
    let mut histogram = vec![0usize; num_bins];
    let mut max_y = f64::NEG_INFINITY;
    let mut points_above_default = 0usize;

    // Single pass: find max and build histogram simultaneously
    for &y in ys {
        if y > max_y {
            max_y = y;
        }
        if y > default_cap {
            points_above_default += 1;
            let bin_idx = if y >= hard_cap {
                num_bins - 1
            } else {
                ((y - default_cap) / bin_size) as usize
            };
            histogram[bin_idx] += 1;
        }
    }

    // Case 1: No points exceed default cap - use actual max
    if max_y <= default_cap {
        return max_y;
    }

    // Walk up from default_cap to hard_cap, using pre-computed total
    let mut points_above = points_above_default;

    // Loop through histogram bins (from lowest to highest). Typically very few bins (e.g. 10-20)
    for (i, &count) in histogram.iter().enumerate() {
        if points_above <= max_capped_points {
            let cap = default_cap + ((i + 1) as f64) * bin_size;
            return cap.min(hard_cap).min(max_y);
        }
        points_above -= count;
    }

    default_cap
}

// Function to Build cumulative chromosome map
fn cumulative_chrom(
    chrom_size: &HashMap<String, u64>,
) -> Result<(HashMap<String, ChromInfo>, u64, Vec<String>), Box<dyn Error>> {
    let mut chrom_data: HashMap<String, ChromInfo> = HashMap::new();
    let mut cumulative_pos: u64 = 0;

    // Sort chromosomes
    let mut sorted_chroms: Vec<String> = chrom_size.keys().cloned().collect();
    sorted_chroms.sort_by_key(|chr| {
        let s = chr.trim_start_matches("chr");
        match s.parse::<u32>() {
            Ok(n) => (0, n),
            Err(_) => match s {
                "X" => (1, 23),
                "Y" => (1, 24),
                "M" | "MT" => (1, 100),
                _ => (2, u32::MAX),
            },
        }
    });

    for chrom in &sorted_chroms {
        if let Some(&size) = chrom_size.get(chrom) {
            chrom_data.insert(
                chrom.clone(),
                ChromInfo {
                    start: cumulative_pos,
                    size: size,
                    center: cumulative_pos + size / 2,
                },
            );
            cumulative_pos += size;
        }
    }
    Ok((chrom_data, cumulative_pos, sorted_chroms))
}

// Function to read the GRIN2 file
fn grin2_file_read(
    grin2_file: &str,
    chrom_data: &HashMap<String, ChromInfo>,
    log_cutoff: f64,
) -> Result<(Vec<u64>, Vec<f64>, Vec<String>, Vec<PointDetail>, Vec<usize>), Box<dyn Error>> {
    // Default colours
    let mut colors: HashMap<String, String> = HashMap::new();
    colors.insert("gain".into(), "#FF4444".into());
    colors.insert("loss".into(), "#4444FF".into());
    colors.insert("mutation".into(), "#44AA44".into());
    colors.insert("fusion".into(), "#FFA500".into());
    colors.insert("sv".into(), "#9932CC".into());

    let mut xs = Vec::new();
    let mut ys = Vec::new();
    let mut colors_vec = Vec::new();
    let mut point_details = Vec::new();
    let mut sig_indices: Vec<usize> = Vec::new();

    let grin2_file = File::open(grin2_file).expect("Failed to open grin2_result_file");
    let mut reader = BufReader::new(grin2_file);
    // get the first line (header line)
    let mut header_line = String::new();
    reader
        .read_line(&mut header_line)
        .expect("Failed to read the first line of grin2_result_file");
    let header: Vec<String> = header_line
        .trim_end()
        .split('\t')
        .map(|s| s.trim().to_string())
        .collect();

    // define the mutation types from the header of grin2 result file
    let mutation_types = ["gain", "loss", "mutation", "fusion", "sv"];
    let mut mutation_indices: HashMap<&str, (usize, Option<usize>)> = HashMap::new();
    for name in &mutation_types {
        let q_col = format!("q.nsubj.{name}");
        let n_col = format!("nsubj.{name}");
        if let Some(q_idx) = header.iter().position(|h| h == &q_col) {
            let n_idx = header.iter().position(|h| h == &n_col);
            mutation_indices.insert(*name, (q_idx, n_idx));
        }
    }

    // extract the index for each required info
    let chrom_idx = header
        .iter()
        .position(|h| h == "chrom")
        .expect("Missing 'chrom' column");
    let gene_idx = header.iter().position(|h| h == "gene").expect("Missing 'gene' column");
    let loc_start_idx = header
        .iter()
        .position(|h| h == "loc.start")
        .expect("Missing 'loc.start' column");
    let loc_end_idx = header
        .iter()
        .position(|h| h == "loc.end")
        .expect("Missing 'loc.end' column");

    // loop all lines
    let mut mut_num: usize = 0;
    for line_result in reader.lines() {
        let line = match line_result {
            Ok(l) => l,
            Err(e) => {
                eprintln!("Error reading line: {}", e);
                continue;
            }
        };

        let fields: Vec<&str> = line.trim_end().split('\t').collect();
        let chrom = match fields.get(chrom_idx).map(|s| s.trim()) {
            Some(s) if !s.is_empty() => s,
            _ => continue,
        };
        let chrom_info = match chrom_data.get(chrom) {
            Some(info) => info,
            None => continue,
        };
        let gene_name = fields.get(gene_idx).unwrap_or(&"").to_string();
        let loc_start_str = match fields.get(loc_start_idx).map(|s| s.trim()) {
            Some(s) if !s.is_empty() => s,
            _ => continue,
        };
        let gene_start: u64 = loc_start_str
            .parse()
            .unwrap_or_else(|_| panic!("Invalid integer for loc.start: '{}' in line: {}", loc_start_str, line));
        let loc_end_str = match fields.get(loc_end_idx).map(|s| s.trim()) {
            Some(s) if !s.is_empty() => s,
            _ => continue,
        };
        let gene_end: u64 = loc_end_str
            .parse()
            .unwrap_or_else(|_| panic!("Invalid integer for loc.end: '{}' in line: {}", loc_end_str, line));
        let x_pos = chrom_info.start + gene_start as u64;

        for (mtype, (q_idx, n_idx_opt)) in &mutation_indices {
            let q_val_str = match fields.get(*q_idx) {
                Some(q) => q,
                None => continue,
            };
            let original_q_val: f64 = match q_val_str.parse() {
                Ok(v) if v >= 0.0 => v,
                _ => continue,
            };

            // Use log_cutoff for zero q-values to avoid -inf. These will be capped later in plotting at log_cutoff
            let neg_log10_q = if original_q_val == 0.0 {
                log_cutoff
            } else {
                -original_q_val.log10()
            };

            let n_subj_count: Option<i64> = n_idx_opt
                .and_then(|i| fields.get(i))
                .and_then(|s| s.parse::<i64>().ok());
            let color = colors.get(*mtype).unwrap_or(&"#888888".to_string()).clone();
            // Add to plotting vectors
            xs.push(x_pos);
            ys.push(neg_log10_q);
            colors_vec.push(color.clone());

            // only add significant points for interactivity
            // We check against the original q-value here so we send back the correct values instead of the 1e-300 used for log transform
            if original_q_val <= 0.05 {
                point_details.push(PointDetail {
                    x: x_pos,
                    y: neg_log10_q,
                    color,
                    r#type: mtype.to_string(),
                    gene: gene_name.clone(),
                    chrom: chrom.to_string(),
                    start: gene_start,
                    end: gene_end,
                    pos: gene_start,
                    q_value: original_q_val,
                    nsubj: n_subj_count,
                    pixel_x: 0.0,
                    pixel_y: 0.0,
                });
                sig_indices.push(mut_num);
            };
            mut_num += 1;
        }
    }

    Ok((xs, ys, colors_vec, point_details, sig_indices))
}

// Function to create the GRIN2 Manhattan plot
fn plot_grin2_manhattan(
    grin2_result_file: String,
    chrom_size: HashMap<String, u64>,
    plot_width: u64,
    plot_height: u64,
    device_pixel_ratio: f64,
    png_dot_radius: u64,
    log_cutoff: f64,
    bin_size: f64,
    max_capped_points: u64,
    hard_cap: f64,
) -> Result<(String, InteractiveData), Box<dyn Error>> {
    // ------------------------------------------------
    // 1. Build cumulative chromosome map
    // ------------------------------------------------

    let mut chrom_data: HashMap<String, ChromInfo> = HashMap::new();
    let mut cumulative_pos: u64 = 0;
    let mut sorted_chroms: Vec<String> = Vec::new();

    if let Ok((chr_data, cum_pos, chrom_sort)) = cumulative_chrom(&chrom_size) {
        chrom_data = chr_data;
        cumulative_pos = cum_pos;
        sorted_chroms = chrom_sort;
    };
    let total_genome_length: i64 = cumulative_pos.try_into().unwrap();
    let x_buffer = (total_genome_length as f64 * 0.005) as i64; // 0.5 % buffer

    // ------------------------------------------------
    // 2. Read file & collect points
    // ------------------------------------------------

    // Declare all data
    let mut xs = Vec::new();
    let mut ys = Vec::new();
    let mut colors_vec = Vec::new();
    let mut point_details = Vec::new();
    let mut sig_indices = Vec::new();

    if let Ok((x, y, c, pd, si)) = grin2_file_read(&grin2_result_file, &chrom_data, log_cutoff) {
        xs = x;
        ys = y;
        colors_vec = c;
        point_details = pd;
        sig_indices = si;
    }

    // ------------------------------------------------
    // 3. Y-axis capping with dynamic cap
    // ------------------------------------------------
    let y_padding = png_dot_radius as f64;
    let y_min = 0.0 - y_padding;

    // Dynamic y-cap calculation:
    // - default_cap: the baseline cap (log_cutoff, typically 40)
    // - max_capped_points: maximum number of points allowed above cap before raising it
    // - hard_cap: absolute maximum cap regardless of data distribution
    // - bin_size: size of bins for histogram approach
    let default_cap = log_cutoff;
    let max_capped_points = max_capped_points as usize;

    let y_cap = calculate_dynamic_y_cap(&ys, default_cap, max_capped_points, hard_cap, bin_size);

    // Jitter range: capped points will spread over this range below the cap line
    let jitter_range = (y_cap * 0.1).max(2.0); // 10% of cap or at least 2 units

    // Track if we have any capped points (to draw the indicator band)
    let mut has_capped_points = false;

    let y_max = if !ys.is_empty() {
        let max_y = ys.iter().cloned().fold(f64::MIN, f64::max);

        // If dynamic cap is higher than default (log_cutoff), elevate q=0 points
        // (which were set to log_cutoff) to the new cap so they remain at the top
        // Apply jitter during elevation to spread them out
        if y_cap > log_cutoff {
            for (i, y) in ys.iter_mut().enumerate() {
                if *y == log_cutoff {
                    let jitter_factor = ((i.wrapping_mul(2654435761)) % 1000) as f64 / 1000.0;
                    *y = y_cap - (jitter_factor * jitter_range);
                    has_capped_points = true;
                }
            }
            for (i, p) in point_details.iter_mut().enumerate() {
                if p.q_value == 0.0 {
                    let jitter_factor = ((sig_indices[i].wrapping_mul(2654435761)) % 1000) as f64 / 1000.0;
                    p.y = y_cap - (jitter_factor * jitter_range);
                }
            }
        }

        if max_y > y_cap {
            has_capped_points = true;
            // Clamp values above the cap and apply jitter to spread them out
            for (i, y) in ys.iter_mut().enumerate() {
                if *y > y_cap {
                    // Deterministic jitter based on index - creates a hash-like spread
                    let jitter_factor = ((i.wrapping_mul(2654435761)) % 1000) as f64 / 1000.0; // 0.0 to 1.0
                    *y = y_cap - (jitter_factor * jitter_range);
                }
            }
            for (i, p) in point_details.iter_mut().enumerate() {
                if p.y > y_cap {
                    let jitter_factor = ((sig_indices[i].wrapping_mul(2654435761)) % 1000) as f64 / 1000.0;
                    p.y = y_cap - (jitter_factor * jitter_range);
                }
            }
            y_cap + 0.35 + y_padding
        } else {
            max_y + 0.35 + y_padding
        }
    } else {
        1.0 + y_padding
    };

    // ------------------------------------------------
    // 4. Setup high-DPR bitmap dimensions
    // ------------------------------------------------

    let dpr = device_pixel_ratio.max(1.0);

    let png_width = plot_width + 2 * png_dot_radius;
    let png_height = plot_height + 2 * png_dot_radius;

    let w: u32 = ((png_width as f64) * dpr) as u32;
    let h: u32 = ((png_height as f64) * dpr) as u32;

    // Create RGB buffer for Plotters
    let mut buffer = vec![0u8; w as usize * h as usize * 3];

    // Make Plotters backend that draws into the RGB buffer (scale-aware)

    let mut pixel_positions: Vec<(f64, f64)> = Vec::with_capacity(xs.len());
    {
        let backend = BitMapBackend::with_buffer(&mut buffer, (w, h));
        let root = backend.into_drawing_area();
        root.fill(&WHITE)?;

        // ------------------------------------------------
        // 5. Build the chart (no axes, no margins)
        // ------------------------------------------------
        let mut chart = ChartBuilder::on(&root)
            .margin(0)
            .set_all_label_area_size(0)
            .build_cartesian_2d((-x_buffer)..(total_genome_length + x_buffer), y_min..y_max)?;

        chart
            .configure_mesh()
            .disable_x_mesh()
            .disable_y_mesh()
            .disable_axes()
            .draw()?;

        // ------------------------------------------------
        // 6. Alternating chromosome backgrounds
        // ------------------------------------------------
        for (i, chrom) in sorted_chroms.iter().enumerate() {
            if let Some(info) = chrom_data.get(chrom) {
                let bg = if i % 2 == 0 { WHITE } else { RGBColor(211, 211, 211) };
                let fill_style: ShapeStyle = bg.mix(0.5).filled();
                let rect = Rectangle::new(
                    [
                        (info.start as i64, (y_min + y_padding)),
                        ((info.start + info.size) as i64, (y_max - y_padding)),
                    ],
                    fill_style,
                );
                chart.draw_series(vec![rect])?;
            }
        }

        // ------------------------------------------------
        // 6b. Draw capped region indicator (shaded band)
        // ------------------------------------------------
        if has_capped_points {
            let band_bottom = y_cap - jitter_range;
            let band_top = y_cap + 0.35;

            // Shaded band - light yellow to indicate "capped/jittered" region
            let band_color = RGBColor(255, 235, 59); // Yellow (#FFEB3B)
            let band_style: ShapeStyle = band_color.mix(0.35).filled();
            let band_rect = Rectangle::new([(-x_buffer, band_bottom), (total_genome_length, band_top)], band_style);
            chart.draw_series(vec![band_rect])?;
        }

        // ------------------------------------------------
        // 7. Capture high-DPR pixel mapping for the points
        //    we do not draw the points with plotters (will use tiny-skia for AA)
        //    but use charts.backend_coord to map data->pixel in the high-DPR backend
        // ------------------------------------------------

        if !xs.is_empty() {
            for (x, y) in xs.iter().zip(ys.iter()) {
                // convert data coords -> high-DPR pixel coords
                let (px, py) = chart.backend_coord(&(*x as i64, *y));
                pixel_positions.push((px as f64, py as f64));
            }
        };

        for (i, p) in point_details.iter_mut().enumerate() {
            let (px, py) = pixel_positions[*&sig_indices[i]];
            p.pixel_x = px / dpr;
            p.pixel_y = py / dpr;
        }

        // flush root drawing area
        root.present()?;
    }

    // Convert Plotters RGB buffer into tiny-skia RGBA pixmap
    let mut pixmap = Pixmap::new(w, h).ok_or("Failed to create pixmap")?;
    {
        let data = pixmap.data_mut();
        let mut src_i = 0usize;
        let mut dst_i = 0usize;
        for _ in 0..(w as usize * h as usize) {
            let r = buffer[src_i];
            let g = buffer[src_i + 1];
            let b = buffer[src_i + 2];
            data[dst_i] = r;
            data[dst_i + 1] = g;
            data[dst_i + 2] = b;
            data[dst_i + 3] = 255u8; // opaque alpha
            src_i += 3;
            dst_i += 4;
        }
    }

    // Draw anti-aliased circles using tiny-skia into the pixmap
    // radius in HIGH-DPR pixels:
    let radius_high_dpr = (png_dot_radius as f32) * (dpr as f32);

    // Paint template
    let mut paint = tiny_skia::Paint::default();

    // for perfomance: reuse a PathBuilder to create circles
    // will create a small path per point
    for i in 0..xs.len() {
        let (px, py) = pixel_positions[i]; // pixel coordinates for this point
        let color_hex = &colors_vec[i];

        let (r_u8, g_u8, b_u8) = match hex_to_rgb(color_hex) {
            Some(rgb) => rgb,
            None => (136u8, 136u8, 136u8),
        };
        paint.set_color_rgba8(r_u8, g_u8, b_u8, 255u8);
        let mut pb = PathBuilder::new();
        pb.push_circle(px as f32, py as f32, radius_high_dpr);

        if let Some(path) = pb.finish() {
            pixmap.fill_path(&path, &paint, FillRule::Winding, Transform::identity(), None);
        };
    }

    // encode pixmap to PNG bytes
    let png_bytes = pixmap.encode_png()?;
    let png_data = BASE64.encode(&png_bytes);

    // ------------------------------------------------
    // 8. Generate interactive data
    // ------------------------------------------------
    let interactive_data = InteractiveData {
        points: point_details,
        chrom_data,
        total_genome_length,
        x_buffer,
        y_min,
        y_max,
        device_pixel_ratio: dpr,
        has_capped_points: has_capped_points,
    };
    Ok((png_data, interactive_data))
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut input = String::new();
    match io::stdin().read_line(&mut input) {
        Ok(_bytes_read) => {
            let input_json: Input = match serde_json::from_str(&input) {
                Ok(json) => json,
                Err(_err) => {
                    panic!("Invalid JSON input");
                }
            };

            // input data type
            // *** might need to change the key later
            let input_data = &input_json.plot_type;

            if input_data == "grin2" {
                let grin2_file = &input_json.file;
                let chrom_size = &input_json.chromosomelist;
                let plot_width = &input_json.plot_width;
                let plot_height = &input_json.plot_height;
                let device_pixel_ratio = &input_json.device_pixel_ratio;
                let png_dot_radius = &input_json.png_dot_radius;
                let log_cutoff = &input_json.log_cutoff;
                let max_capped_points = &input_json.max_capped_points;
                let hard_cap = &input_json.hard_cap;
                let bin_size = &input_json.bin_size;
                if let Ok((base64_string, plot_data)) = plot_grin2_manhattan(
                    grin2_file.clone(),
                    chrom_size.clone(),
                    plot_width.clone(),
                    plot_height.clone(),
                    device_pixel_ratio.clone(),
                    png_dot_radius.clone(),
                    log_cutoff.clone(),
                    bin_size.clone(),
                    max_capped_points.clone(),
                    hard_cap.clone(),
                ) {
                    let output = Output {
                        png: base64_string,
                        plot_data,
                    };
                    if let Ok(json) = serde_json::to_string(&output) {
                        println!("{}", json);
                    }
                } else {
                    eprintln!("Failed to generate Manhattan plot");
                };
            }
        }
        Err(_err) => {
            panic!("Error reading input JSON!");
        }
    }
    Ok(())
}
