/*
    This script plots the GRIN2/GWAS(for future) results as a Manhattan plot, and returns the plot as a base64-encoded PNG image and plot details.
    Input JSON:
        file: <path to the cache result file>
        type: <plot type: grin2 | gwas>
        chrSizes: <chromosome sizes map>
        plot_width: <plot width>
        plot_height: <plot height>
        device_pixel_ratio: <device pixel ratio>
        png_dot_radius: <PNG dot radius>

    Output JSON:
        png: <base64-encoded PNG image>
        plot_data: <plot details>

    Example of usage:
    echo '{"file":"/Users/jwang7/data/cache/grin2/grin2_results_5282a8400a0fe288129e0c21f3126851.txt", "chromosomelist":{"chr1":248956422,"chr2":242193529,"chr3":198295559,"chr4":190214555,"chr5":181538259,"chr6":170805979,"chr7":159345973,"chr8":145138636,"chr9":138394717,"chr10":133797422,"chr11":135086622,"chr12":133275309,"chr13":114364328,"chr14":107043718,"chr15":101991189,"chr16":90338345,"chr17":83257441,"chr18":80373285,"chr19":58617616,"chr20":64444167,"chr21":46709983,"chr22":50818468,"chrX":156040895,"chrY":57227415,"chrM":16569},"input_type":"grin2", "plot_width":1000,"plot_height":400,"device_pixel_ratio":2.0,"png_dot_radius":2}' | ./target/release/manhattan_plot
*/

use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use image::{ImageBuffer, ImageOutputFormat, Rgb};
use plotters::prelude::*;
use plotters::style::ShapeStyle;
use serde::{Deserialize, Serialize};
use serde_json;
use std::collections::HashMap;
use std::convert::TryInto;
use std::error::Error;
use std::fs::File;
use std::fs::OpenOptions;
use std::io::Cursor;
use std::io::Write;
use std::io::{self, BufRead, BufReader};

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
}

#[derive(Serialize)]
struct InteractiveData {
    points: Vec<PointDetail>,
    chrom_data: HashMap<String, ChromInfo>,
    y_axis_scaled: bool,
    scale_factor: f64,
    total_genome_length: i64,
    x_buffer: i64,
    y_min: f64,
    y_max: f64,
    plot_width: u64,
    plot_height: u64,
    png_width: u64,
    png_height: u64,
    device_pixel_ratio: f64,
    png_dot_radius: u64,
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

/// Log coordinates to debug file
fn log_coordinates_to_file(
    genomic_x: u64,
    y_value: f64,
    pixel_x: f64,
    pixel_y: f64,
    gene: &str,
    chrom: &str,
    mutation_type: &str,
) {
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open("/tmp/manhattan_coordinates_debug.txt")
        .expect("Unable to open debug file");

    writeln!(
        file,
        "Gene: {}, Chrom: {}, Type: {}, genomic_x: {}, y_value: {:.3}, pixel_x: {:.2}, pixel_y: {:.2}",
        gene, chrom, mutation_type, genomic_x, y_value, pixel_x, pixel_y
    )
    .expect("Unable to write to debug file");
}

/// Initialize debug file with header information
fn init_debug_file(png_width: u64, png_height: u64, x_buffer: i64, total_genome_length: i64, y_max: f64) {
    let mut file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true) // Clear file on new run
        .open("/tmp/manhattan_coordinates_debug.txt")
        .expect("Unable to open debug file");

    writeln!(file, "=== Manhattan Plot Coordinate Debug ===").unwrap();
    writeln!(
        file,
        "png_width: {}, png_height: {}, x_buffer: {}, total_genome_length: {}, y_max: {:.3}\n",
        png_width, png_height, x_buffer, total_genome_length, y_max
    )
    .unwrap();
}

/// Convert genomic x coordinate to pixel space
fn genomic_to_pixel_x(genomic_x: u64, x_buffer: i64, total_genome_length: i64, png_width: u64) -> f64 {
    let domain_min = -x_buffer as f64;
    let domain_max = (total_genome_length + x_buffer) as f64;
    let domain_range = domain_max - domain_min;

    ((genomic_x as f64 - domain_min) / domain_range) * png_width as f64
}

/// Convert y value (-log10 q-value) to pixel space
fn qvalue_to_pixel_y(y_value: f64, y_max: f64, png_height: u64) -> f64 {
    // Note: Y-axis is inverted in screen coordinates
    png_height as f64 - ((y_value / y_max) * png_height as f64)
}

// Function to create the GRIN2 Manhattan plot
fn plot_grin2_manhattan(
    grin2_result_file: String,
    chrom_size: HashMap<String, u64>,
    plot_width: u64,
    plot_height: u64,
    device_pixel_ratio: f64,
    png_dot_radius: u64,
) -> Result<(String, InteractiveData), Box<dyn Error>> {
    // ------------------------------------------------
    // 1. Default colours
    // ------------------------------------------------
    let mut colors: HashMap<String, String> = HashMap::new();
    colors.insert("gain".into(), "#FF4444".into());
    colors.insert("loss".into(), "#4444FF".into());
    colors.insert("mutation".into(), "#44AA44".into());
    colors.insert("fusion".into(), "#FFA500".into());
    colors.insert("sv".into(), "#9932CC".into());

    // ------------------------------------------------
    // 2. PNG size (pad for dot radius)
    // ------------------------------------------------
    let png_width = plot_width + 2 * png_dot_radius;
    let png_height = plot_height + 2 * png_dot_radius;

    // ------------------------------------------------
    // 3. Buffer size
    // ------------------------------------------------
    let w: u32 = (png_width * device_pixel_ratio as u64)
        .try_into()
        .expect("PNG width too large for u32");
    let h: u32 = (png_height * device_pixel_ratio as u64)
        .try_into()
        .expect("PNG height too large for u32");
    let mut buffer = vec![0u8; w as usize * h as usize * 3];

    // Declare all data
    let mut xs = Vec::new();
    let mut ys = Vec::new();
    let mut colors_vec = Vec::new();
    let mut types = Vec::new();
    let mut point_details = Vec::new();
    let mut y_axis_scaled = false;
    let mut scale_factor_y = 1.0;
    let y_min = 0.0;

    // ------------------------------------------------
    // 4. Build cumulative chromosome map
    // ------------------------------------------------
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
    let total_genome_length: i64 = cumulative_pos.try_into().unwrap();
    let x_buffer = (total_genome_length as f64 * 0.005) as i64; // 0.5 % buffer

    // ------------------------------------------------
    // 5. Read file & collect points
    // ------------------------------------------------

    let grin2_file = File::open(grin2_result_file).expect("Failed to open grin2_result_file");
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
            let q_val: f64 = match q_val_str.parse() {
                Ok(v) if v > 0.0 => v,
                _ => continue,
            };
            let neg_log10_q = -q_val.log10();
            let n_subj_count: Option<i64> = n_idx_opt
                .and_then(|i| fields.get(i))
                .and_then(|s| s.parse::<i64>().ok());
            let color = colors.get(*mtype).unwrap_or(&"#888888".to_string()).clone();
            // Add to plotting vectors
            xs.push(x_pos);
            ys.push(neg_log10_q);
            colors_vec.push(color.clone());
            types.push(mtype.to_string());

            // only add significant points for interactivity
            if q_val <= 0.05 {
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
                    q_value: q_val,
                    nsubj: n_subj_count,
                });
            }
        }
    }

    // ------------------------------------------------
    // 6. Y-axis scaling
    // ------------------------------------------------

    let y_max = if !ys.is_empty() {
        let max_y = ys.iter().cloned().fold(f64::MIN, f64::max);
        if max_y > 40.0 {
            let target = 40.0;
            scale_factor_y = target / max_y;
            y_axis_scaled = true;

            for y in ys.iter_mut() {
                *y *= scale_factor_y;
            }
            for p in point_details.iter_mut() {
                p.y *= scale_factor_y;
            }
            let scaled_max = ys.iter().cloned().fold(f64::MIN, f64::max);
            scaled_max + 0.35
        } else {
            max_y + 0.35
        }
    } else {
        1.0
    };

    // Initialize debug file with plot parameters
    init_debug_file(png_width, png_height, x_buffer, total_genome_length, y_max);

    // Log all point coordinates for debugging
    for point in &point_details {
        let pixel_x = genomic_to_pixel_x(point.x, x_buffer, total_genome_length, png_width);
        let pixel_y = qvalue_to_pixel_y(point.y, y_max, png_height);

        log_coordinates_to_file(
            point.x,
            point.y,
            pixel_x,
            pixel_y,
            &point.gene,
            &point.chrom,
            &point.r#type,
        );
    }

    // In-memory bitmap
    // plotters cannot encode PNG in memory without image crate
    // Despite with_buffer_and_format, there is no write_to method that produces PNG.
    // image crate is required
    {
        let root = BitMapBackend::with_buffer(&mut buffer, (w, h)).into_drawing_area();
        root.fill(&WHITE)?;

        // ------------------------------------------------
        // 7. Build the chart (no axes, no margins)
        // ------------------------------------------------

        let mut chart = ChartBuilder::on(&root)
            .margin_left(png_dot_radius as u32)
            .margin_right(png_dot_radius as u32)
            .margin_top(png_dot_radius as u32)
            .margin_bottom(png_dot_radius as u32)
            .set_all_label_area_size(0)
            .build_cartesian_2d((-x_buffer)..(total_genome_length + x_buffer), y_min..y_max)?;

        chart
            .configure_mesh()
            .disable_x_mesh()
            .disable_y_mesh()
            .disable_axes()
            .draw()?;

        // ------------------------------------------------
        // 8. Alternating chromosome backgrounds
        // ------------------------------------------------
        for (i, chrom) in sorted_chroms.iter().enumerate() {
            if let Some(info) = chrom_data.get(chrom) {
                let bg = if i % 2 == 0 { WHITE } else { RGBColor(211, 211, 211) };
                let fill_style: ShapeStyle = bg.mix(0.5).filled();
                let rect = Rectangle::new(
                    [(info.start as i64, y_min), ((info.start + info.size) as i64, y_max)],
                    fill_style,
                );
                chart.draw_series(vec![rect])?;
            }
        }

        // ------------------------------------------------
        // 9. Scatter points
        // ------------------------------------------------

        if !xs.is_empty() {
            let pixel_radius = png_dot_radius as u32 * device_pixel_ratio as u32;
            chart.draw_series(xs.iter().zip(ys.iter()).zip(colors_vec.iter()).map(|((x, y), hex)| {
                let (r, g, b) = hex_to_rgb(hex).unwrap_or((136, 136, 136));
                let fill_style: ShapeStyle = RGBColor(r, g, b).mix(0.7).filled();
                Circle::new((*x as i64, *y), pixel_radius, fill_style)
            }))?;
        };

        // ------------------------------------------------
        // 10. Finish drawing – buffer now contains PNG bytes
        // ------------------------------------------------
        root.present()?;
    }

    // --- Convert RGB buffer to PNG using `image` ---
    let img = ImageBuffer::from_fn(w, h, |x, y| {
        let i = (y as usize * w as usize + x as usize) * 3;
        Rgb([buffer[i], buffer[i + 1], buffer[i + 2]])
    });
    let mut png_data = Vec::new();
    img.write_to(&mut Cursor::new(&mut png_data), ImageOutputFormat::Png)?;

    // ------------------------------------------------
    // 11. Encode to Base64
    // ------------------------------------------------
    let png_base64 = BASE64.encode(&png_data);
    //let png_base64 = format!("data:image/png;base64,{}", b64);

    // ------------------------------------------------
    // 12. Generate interactive data
    // ------------------------------------------------
    let interactive_data = InteractiveData {
        points: point_details,
        chrom_data,
        y_axis_scaled,
        scale_factor: scale_factor_y,
        total_genome_length,
        x_buffer,
        y_min,
        y_max,
        plot_width,
        plot_height,
        png_width,
        png_height,
        device_pixel_ratio,
        png_dot_radius,
    };
    Ok((png_base64, interactive_data))
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
                if let Ok((base64_string, plot_data)) = plot_grin2_manhattan(
                    grin2_file.clone(),
                    chrom_size.clone(),
                    plot_width.clone(),
                    plot_height.clone(),
                    device_pixel_ratio.clone(),
                    png_dot_radius.clone(),
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
