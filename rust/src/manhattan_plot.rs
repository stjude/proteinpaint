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

/// Calculate dynamic y-cap using histogram approach - O(n) time, O(1) space
///
/// Strategy:
/// 1. If max_y <= default_cap: no capping needed, return max_y
/// 2. If points above default_cap <= threshold_pct: use default_cap
/// 3. Otherwise: find the lowest cap such that <= threshold_pct points are above it
///
/// Uses a fixed-size histogram (NUM_BUCKETS) to avoid sorting.
/// For 10M points, this is ~40MB less memory than storing a sorted copy.
fn calculate_dynamic_y_cap(
    ys: &[f64],
    default_cap: f64,
    threshold_pct: f64, // e.g., 0.0001 for 0.01%
) -> f64 {
    const NUM_BUCKETS: usize = 1000;

    let total_points = ys.len();
    if total_points == 0 {
        return default_cap;
    }

    // Single pass: find max_y and count points above default_cap
    let mut max_y = f64::MIN;
    let mut count_above_default = 0usize;

    for &y in ys {
        if y > max_y {
            max_y = y;
        }
        if y > default_cap {
            count_above_default += 1;
        }
    }

    // Case 1: No points exceed default cap - use actual max
    if max_y <= default_cap {
        return max_y;
    }

    // Case 2: Points above default cap are within threshold - use default cap
    // Use float comparison to handle very small thresholds correctly
    let threshold_count = (total_points as f64) * threshold_pct;
    if (count_above_default as f64) <= threshold_count {
        return default_cap;
    }

    // Case 3: Need dynamic cap - build histogram for values in (default_cap, max_y]
    // We need to find a cap where count_above <= threshold_count

    let range = max_y - default_cap;
    let bucket_width = range / (NUM_BUCKETS as f64);

    // Histogram: bucket[i] counts points in range (default_cap + i*width, default_cap + (i+1)*width]
    let mut histogram = [0usize; NUM_BUCKETS];

    for &y in ys {
        if y > default_cap {
            // Map y to bucket index
            let bucket_idx = ((y - default_cap) / bucket_width) as usize;
            // Clamp to valid range (handles y == max_y edge case)
            let bucket_idx = bucket_idx.min(NUM_BUCKETS - 1);
            histogram[bucket_idx] += 1;
        }
    }

    // Walk from highest bucket down, accumulating count until we exceed threshold
    // The cap should be set at the lower edge of the first bucket where
    // cumulative count from above exceeds threshold
    let mut cumulative_above = 0usize;

    for i in (0..NUM_BUCKETS).rev() {
        cumulative_above += histogram[i];

        // If adding this bucket pushes us over threshold, cap at upper edge of this bucket
        if (cumulative_above as f64) > threshold_count {
            // Cap at the upper edge of this bucket
            // Points in buckets i+1 to NUM_BUCKETS-1 will be capped (they're above this)
            // We want the cap to be at bucket i's upper edge
            let cap = default_cap + ((i + 1) as f64) * bucket_width;
            return cap;
        }
    }

    // If we get here, all points above default_cap fit within threshold (shouldn't happen
    // given our earlier check, but return default_cap as fallback)
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
    // - threshold_pct: 1e-6 (0.0001%) - if more than this % of points exceed cap, raise it
    let default_cap = log_cutoff;
    const THRESHOLD_PCT: f64 = 1e-6; // 0.0001%

    let y_cap = calculate_dynamic_y_cap(&ys, default_cap, THRESHOLD_PCT);

    // Jitter range: capped points will spread over this range below the cap line
    let jitter_range = (y_cap * 0.05).max(1.0); // 5% of cap or at least 1 unit

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
            let band_top = y_cap;

            // Shaded band - light yellow to indicate "capped/jittered" region
            let band_color = RGBColor(255, 235, 59); // Yellow (#FFEB3B)
            let band_style: ShapeStyle = band_color.mix(0.35).filled();
            let band_rect = Rectangle::new(
                [(-x_buffer, band_bottom), (total_genome_length + x_buffer, band_top)],
                band_style,
            );
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
                if let Ok((base64_string, plot_data)) = plot_grin2_manhattan(
                    grin2_file.clone(),
                    chrom_size.clone(),
                    plot_width.clone(),
                    plot_height.clone(),
                    device_pixel_ratio.clone(),
                    png_dot_radius.clone(),
                    log_cutoff.clone(),
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
