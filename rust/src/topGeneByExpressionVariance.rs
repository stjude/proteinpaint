/*
 This script selects the top most variant genes by calculating the variance/interquartile region for each gene.
 Added support for HDF5 input files alongside the existing text file support.

Various JSON parameters:
   samples: Enter the sample ID(s) separated by comma
   input_file: Path to input file (either text or HDF5 format)
   filter_extreme_values: boolean (true/false). When true, this filter according to logic filterbyExpr in edgeR. This basically removes genes that have very low gene counts.
   num_genes: The top num_genes (for e.g 10) that need to be reported in the output.
   rank_type: var/iqr . This parameter decides whether to sort genes using variance or interquartile region. There is an article which states that its better to use interquartile region than variance for selecting genes for clustering https://www.frontiersin.org/articles/10.3389/fgene.2021.632620/full
   newformat?: bool. Used to support new format HDF5

 Example syntax: cd .. && cargo build --release && json='{"samples":"sample1,sample2,sample3","min_count":30,"min_total_count":20,"input_file":"/path/to/input/file.h5","filter_extreme_values":true,"num_genes":100, "rank_type":"var"}' && time echo $json | target/release/gene_variance

 Usage for new format HDF5
    echo '{"samples":"sample1,sample2,sample3","newformat":true,"min_count":30,"min_total_count":20,"input_file":"/path/to/input/file.h5","filter_extreme_values":true,"num_genes":100, "rank_type":"var"}' | ./target/release/topGeneByExpressionVariance
*/
#![allow(non_snake_case)]
use bgzip::BGZFReader;
use json;
use nalgebra::DMatrix;
use nalgebra::base::Matrix;
use nalgebra::base::VecStorage;
use nalgebra::base::dimension::Dyn;
use serde::{Deserialize, Serialize};
use serde_json;
use statrs::statistics::Data;
use statrs::statistics::Median;
use statrs::statistics::OrderStatistics;
use statrs::statistics::Statistics;
use std::cmp::Ordering;
use std::fs;
use std::io;
use std::io::Read;
use std::str::FromStr;
// use std::time::Instant;
use hdf5::types::{VarLenAscii, VarLenUnicode};
use hdf5::{File, Result};
use ndarray::Dim;

/// Read expression data from a dense HDF5 file for a list of samples
///
/// This function extracts expression data from a dense format HDF5 file for
/// the specified samples and returns it in the format expected by the
/// gene variance calculation code.
///
/// # Arguments
///
/// * `filename` - Path to the HDF5 file
/// * `sample_list` - List of sample IDs to extract data for
///
/// # Returns
///
/// A Result containing either:
/// - A tuple with expression matrix and gene symbols list on success, or
/// - An error with details formatted as JSON
fn input_data_hdf5(
    filename: &String,
    sample_list: &Vec<&str>,
) -> Result<(Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>>, Vec<String>)> {
    // let now = Instant::now();
    // eprintln!("Reading HDF5 file: {}", filename);

    // Open the HDF5 file
    let file = match File::open(filename) {
        Ok(f) => f,
        Err(err) => {
            // eprintln!("Failed to open HDF5 file: {}", err);
            // println!(
            //     "{}",
            //     serde_json::json!({
            //         "status": "error",
            //         "message": format!("Failed to open HDF5 file: {}", err),
            //         "file_path": filename
            //     })
            // );
            return Err(hdf5::Error::Internal(format!("Failed to open HDF5 file: {}", err)));
        }
    };

    // Read gene symbols dataset
    let genes_dataset = match file.dataset("gene_names") {
        Ok(ds) => ds,
        Err(err) => {
            // eprintln!("Failed to open gene_names dataset: {}", err);
            // println!(
            //     "{}",
            //     serde_json::json!({
            //         "status": "error",
            //         "message": format!("Failed to open gene_names dataset: {}", err),
            //         "file_path": filename
            //     })
            // );
            return Err(hdf5::Error::Internal(format!(
                "Failed to open gene_names dataset: {}",
                err
            )));
        }
    };

    // Read genes as VarLenAscii
    let genes_varlen = match genes_dataset.read_1d::<VarLenAscii>() {
        Ok(g) => g,
        Err(err) => {
            // eprintln!("Failed to read gene symbols: {}", err);
            // println!(
            //     "{}",
            //     serde_json::json!({
            //         "status": "error",
            //         "message": format!("Failed to read gene symbols: {}", err),
            //         "file_path": filename
            //     })
            // );
            return Err(hdf5::Error::Internal(format!("Failed to read gene symbols: {}", err)));
        }
    };

    // Convert to Vec<String> for easier handling
    let gene_names: Vec<String> = genes_varlen.iter().map(|g| g.to_string()).collect();
    let num_genes = gene_names.len();
    // eprintln!("Found {} gene symbols", num_genes);

    // Read sample names
    let samples_dataset = match file.dataset("samples") {
        Ok(ds) => ds,
        Err(err) => {
            // eprintln!("Failed to open samples dataset: {}", err);
            println!(
                "{}",
                serde_json::json!({
                    "status": "error",
                    "message": format!("Failed to open samples dataset: {}", err),
                    "file_path": filename
                })
            );
            return Err(hdf5::Error::Internal(format!(
                "Failed to open samples dataset: {}",
                err
            )));
        }
    };

    // Read samples as VarLenAscii
    let samples_varlen = match samples_dataset.read_1d::<VarLenAscii>() {
        Ok(s) => s,
        Err(err) => {
            // eprintln!("Failed to read sample names: {}", err);
            println!(
                "{}",
                serde_json::json!({
                    "status": "error",
                    "message": format!("Failed to read sample names: {}", err),
                    "file_path": filename
                })
            );
            return Err(hdf5::Error::Internal(format!("Failed to read sample names: {}", err)));
        }
    };

    // Convert to Vec<String> for easier handling
    let all_samples: Vec<String> = samples_varlen.iter().map(|s| s.to_string()).collect();
    // eprintln!("Found {} total samples", all_samples.len());

    // Find indices of requested samples
    let mut column_indices: Vec<usize> = Vec::with_capacity(sample_list.len());
    for sample in sample_list {
        if let Some(index) = all_samples.iter().position(|s| s == sample) {
            column_indices.push(index);
        } else {
            // eprintln!("Sample {} not found in the dataset", sample);
            // println!(
            //     "{}",
            //     serde_json::json!({
            //         "status": "error",
            //         "message": format!("Sample '{}' not found in the dataset", sample),
            //         "file_path": filename,
            //         "available_samples": all_samples
            //     })
            // );
            return Err(hdf5::Error::Internal(format!(
                "Sample '{}' not found in the dataset",
                sample
            )));
        }
    }

    // Read the counts dataset
    let counts_dataset = match file.dataset("counts") {
        Ok(ds) => ds,
        Err(err) => {
            // eprintln!("Failed to open counts dataset: {}", err);
            // println!(
            //     "{}",
            //     serde_json::json!({
            //         "status": "error",
            //         "message": format!("Failed to open counts dataset: {}", err),
            //         "file_path": filename
            //     })
            // );
            return Err(hdf5::Error::Internal(format!("Failed to open counts dataset: {}", err)));
        }
    };

    // Get dataset dimensions for validation
    let dataset_shape = counts_dataset.shape();
    if dataset_shape.len() != 2 {
        // eprintln!("Counts dataset does not have the expected 2D shape");
        // println!(
        //     "{}",
        //     serde_json::json!({
        //         "status": "error",
        //         "message": "Expected a 2D dataset for counts",
        //         "file_path": filename,
        //         "actual_shape": dataset_shape
        //     })
        // );
        return Err(hdf5::Error::Internal("Expected a 2D dataset for counts".to_string()));
    }

    // Check dimensions match expected values
    if dataset_shape[0] != num_genes {
        // eprintln!(
        //     "Counts dataset first dimension ({}) doesn't match number of genes ({})",
        //     dataset_shape[0], num_genes
        // );
        // println!(
        //     "{}",
        //     serde_json::json!({
        //         "status": "error",
        //         "message": format!("Counts dataset first dimension ({}) doesn't match number of genes ({})",
        //                         dataset_shape[0], num_genes),
        //         "file_path": filename
        //     })
        // );
        return Err(hdf5::Error::Internal(format!(
            "Counts dataset first dimension ({}) doesn't match number of genes ({})",
            dataset_shape[0], num_genes
        )));
    }

    if dataset_shape[1] != all_samples.len() {
        // eprintln!(
        //     "Counts dataset second dimension ({}) doesn't match number of samples ({})",
        //     dataset_shape[1],
        //     all_samples.len()
        // );
        // println!(
        //     "{}",
        //     serde_json::json!({
        //         "status": "error",
        //         "message": format!("Counts dataset second dimension ({}) doesn't match number of samples ({})",
        //                         dataset_shape[1], all_samples.len()),
        //         "file_path": filename
        //     })
        // );
        return Err(hdf5::Error::Internal(format!(
            "Counts dataset second dimension ({}) doesn't match number of samples ({})",
            dataset_shape[1],
            all_samples.len()
        )));
    }

    // Read the counts dataset
    let all_counts = match counts_dataset.read::<f64, Dim<[usize; 2]>>() {
        Ok(data) => data,
        Err(err) => {
            // eprintln!("Failed to read expression data: {}", err);
            // println!(
            //     "{}",
            //     serde_json::json!({
            //         "status": "error",
            //         "message": format!("Failed to read expression data: {}", err),
            //         "file_path": filename
            //     })
            // );
            return Err(hdf5::Error::Internal(format!(
                "Failed to read expression data: {}",
                err
            )));
        }
    };

    // Extract only the columns corresponding to the requested samples
    // eprintln!(
    //     "Extracting data for {} requested samples",
    //     sample_list.len()
    // );
    let mut input_vector: Vec<f64> = Vec::with_capacity(num_genes * sample_list.len());

    for gene_idx in 0..num_genes {
        for &col_idx in &column_indices {
            input_vector.push(all_counts[[gene_idx, col_idx]]);
        }
    }

    // Create matrix from the extracted data
    let dm = DMatrix::from_row_slice(num_genes, sample_list.len(), &input_vector);

    // eprintln!("Time for reading HDF5 data: {:?}", now.elapsed());
    // eprintln!(
    //     "Successfully extracted expression data matrix of size {}x{}",
    //     dm.nrows(),
    //     dm.ncols()
    // );

    Ok((dm, gene_names))
}

// Similar to input_data_hdf5, but specifically for new H5 format
fn input_data_hdf5_newformat(
    filename: &String,
    sample_list: &Vec<&str>,
) -> Result<(Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>>, Vec<String>)> {
    // Open the HDF5 file
    let file = match File::open(filename) {
        Ok(f) => f,
        Err(err) => {
            return Err(hdf5::Error::Internal(format!("Failed to open HDF5 file: {}", err)));
        }
    };

    // Read gene symbols dataset
    let genes_dataset = match file.dataset("item") {
        Ok(ds) => ds,
        Err(err) => {
            return Err(hdf5::Error::Internal(format!(
                "Failed to open gene_names dataset: {}",
                err
            )));
        }
    };

    // Read genes as VarLenAscii
    let genes_varlen = match genes_dataset.read_1d::<VarLenUnicode>() {
        Ok(g) => g,
        Err(err) => {
            return Err(hdf5::Error::Internal(format!("Failed to read gene symbols: {}", err)));
        }
    };

    // Convert to Vec<String> for easier handling
    let gene_names: Vec<String> = genes_varlen.iter().map(|g| g.to_string()).collect();
    let num_genes = gene_names.len();

    // Read sample names
    let samples_dataset = match file.dataset("samples") {
        Ok(ds) => ds,
        Err(err) => {
            println!(
                "{}",
                serde_json::json!({
                    "status": "error",
                    "message": format!("Failed to open samples dataset: {}", err),
                    "file_path": filename
                })
            );
            return Err(hdf5::Error::Internal(format!(
                "Failed to open samples dataset: {}",
                err
            )));
        }
    };

    // Read samples as VarLenAscii
    let samples_varlen = match samples_dataset.read_1d::<VarLenUnicode>() {
        Ok(s) => s,
        Err(err) => {
            // eprintln!("Failed to read sample names: {}", err);
            println!(
                "{}",
                serde_json::json!({
                    "status": "error",
                    "message": format!("Failed to read sample names: {}", err),
                    "file_path": filename
                })
            );
            return Err(hdf5::Error::Internal(format!("Failed to read sample names: {}", err)));
        }
    };

    // Convert to Vec<String> for easier handling
    let all_samples: Vec<String> = samples_varlen.iter().map(|s| s.to_string()).collect();

    // Find indices of requested samples
    let mut column_indices: Vec<usize> = Vec::with_capacity(sample_list.len());
    for sample in sample_list {
        if let Some(index) = all_samples.iter().position(|s| s == sample) {
            column_indices.push(index);
        } else {
            return Err(hdf5::Error::Internal(format!(
                "Sample '{}' not found in the dataset",
                sample
            )));
        }
    }

    // Read the counts dataset
    let counts_dataset = match file.dataset("matrix") {
        Ok(ds) => ds,
        Err(err) => {
            return Err(hdf5::Error::Internal(format!("Failed to open counts dataset: {}", err)));
        }
    };

    // Get dataset dimensions for validation
    let dataset_shape = counts_dataset.shape();
    if dataset_shape.len() != 2 {
        return Err(hdf5::Error::Internal("Expected a 2D dataset for counts".to_string()));
    };

    // Check dimensions match expected values
    if dataset_shape[0] != num_genes {
        return Err(hdf5::Error::Internal(format!(
            "Counts dataset first dimension ({}) doesn't match number of genes ({})",
            dataset_shape[0], num_genes
        )));
    };

    if dataset_shape[1] != all_samples.len() {
        return Err(hdf5::Error::Internal(format!(
            "Counts dataset second dimension ({}) doesn't match number of samples ({})",
            dataset_shape[1],
            all_samples.len()
        )));
    };

    // Read the counts dataset
    let all_counts = match counts_dataset.read::<f64, Dim<[usize; 2]>>() {
        Ok(data) => data,
        Err(err) => {
            return Err(hdf5::Error::Internal(format!(
                "Failed to read expression data: {}",
                err
            )));
        }
    };

    let mut input_vector: Vec<f64> = Vec::with_capacity(num_genes * sample_list.len());

    for gene_idx in 0..num_genes {
        for &col_idx in &column_indices {
            input_vector.push(all_counts[[gene_idx, col_idx]]);
        }
    }

    // Create matrix from the extracted data
    let dm = DMatrix::from_row_slice(num_genes, sample_list.len(), &input_vector);

    Ok((dm, gene_names))
}

// The original input_data function for text files is kept as is
fn input_data(
    filename: &String,
    sample_list: &Vec<&str>,
) -> (Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>>, Vec<String>) {
    // Build the CSV reader and iterate over each record.
    let mut reader = BGZFReader::new(fs::File::open(filename).unwrap()).unwrap();
    let mut num_lines: usize = 0;
    let mut gene_names: Vec<String> = Vec::with_capacity(500);

    let mut buffer = String::new();
    reader.read_to_string(&mut buffer).unwrap();

    let lines = buffer.split("\n");
    let mut first = true;
    let mut input_vector: Vec<f64> = Vec::with_capacity(1000 * 500);
    let mut column_numbers: Vec<usize> = Vec::with_capacity(300);
    for line in lines {
        if first == true {
            first = false;
            let columns: Vec<&str> = line.split("\t").collect();
            // Finding column numbers corresponding to each sample given in the input list
            for item in sample_list {
                if let Some(index) = columns.iter().position(|num| num == item) {
                    column_numbers.push(index)
                } else {
                    panic!("Sample {} not found:", item)
                }
            }
        } else {
            let line2: Vec<&str> = line.split("\t").collect();
            if line2.len() == 1 {
                break; // end of file
            } else {
                num_lines += 1;
                //println!("line2:{:?}", line2);
                gene_names.push(line2[3].to_string());
                for i in &column_numbers {
                    let field = line2[*i];
                    let num = FromStr::from_str(field);
                    match num {
                        Ok(n) => {
                            //println!("n:{}", n);
                            input_vector.push(n);
                        }
                        Err(_n) => {
                            panic!(
                                "Number {} in line {} and column {} is not a decimal number",
                                field,
                                num_lines + 1,
                                i + 1
                            );
                        }
                    }
                }
            }
        }
    }

    //println!("case_indexes:{:?}", case_indexes);
    //println!("control_indexes:{:?}", control_indexes);

    let dm = DMatrix::from_row_slice(num_lines, sample_list.len(), &input_vector);
    //println!("dm:{:?}", dm);
    (dm, gene_names)
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
struct GeneInfo {
    gene_symbol: String,
    rank_type: f64,
}

fn calculate_variance(
    input_matrix: Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>>,
    gene_names: Vec<String>,
    mut min_sample_size: f64,
    filter_extreme_values: bool,
    rank_type: String,
    min_count_option: Option<f64>,
    min_total_count_option: Option<f64>,
) -> Vec<GeneInfo> {
    let mut min_count: f64 = 10.0;
    match min_count_option {
        Some(x) => min_count = x,
        None => {}
    }
    let mut min_total_count: f64 = 15.0;
    match min_total_count_option {
        Some(x) => min_total_count = x,
        None => {}
    }
    //const MIN_COUNT: f64 = 10.0; // Value of constant from R implementation
    //const MIN_TOTAL_COUNT: f64 = 15.0; // Value of constant from R implementation
    const LARGE_N: f64 = 10.0; // Value of constant from R implementation
    const MIN_PROP: f64 = 0.7; // Value of constant from R implementation

    if min_sample_size == 0.0 {
        panic!("Only one condition present in groups");
    }

    if min_sample_size > LARGE_N {
        min_sample_size = LARGE_N + (min_sample_size - LARGE_N) * MIN_PROP;
    }

    let mut lib_sizes = Vec::<f64>::new();
    let lib_sizes_vector = input_matrix.row_sum();
    //println!("lib_sizes_vector:{:?}", lib_sizes_vector);
    for i in 0..lib_sizes_vector.ncols() {
        lib_sizes.push(lib_sizes_vector[(0, i)].into());
    }
    //println!("lib_sizes:{:?}", lib_sizes);
    //println!("min_sample_size:{}", min_sample_size);
    let median_lib_size = Data::new(lib_sizes.clone()).median();
    let cpm_cutoff = (min_count / median_lib_size) * 1000000.0;
    //println!("cpm_cutoff:{}", cpm_cutoff);
    let cpm_matrix = cpm(&input_matrix);
    const TOL: f64 = 1e-14; // Value of constant from R implementation

    let mut gene_infos = Vec::<GeneInfo>::new();
    let row_sums = input_matrix.column_sum();
    for row in 0..input_matrix.nrows() {
        let mut trues = 0.0;
        for col in 0..cpm_matrix.ncols() {
            if cpm_matrix[(row, col)] >= cpm_cutoff {
                trues += 1.0;
            }
        }
        let mut keep_cpm_bool = false;
        if trues >= min_sample_size - TOL {
            keep_cpm_bool = true;
            //keep_cpm.push(keep_cpm_bool);
            //positive_cpm += 1;
        }

        let mut keep_total_bool = false;
        if row_sums[(row, 0)] as f64 >= min_total_count - TOL {
            keep_total_bool = true;
            //keep_total.push(keep_total_bool);
            //positive_total += 1;
        }

        let mut gene_counts: Vec<f64> = Vec::with_capacity(input_matrix.ncols());
        for col in 0..input_matrix.ncols() {
            gene_counts.push(input_matrix[(row, col)]);
        }
        if rank_type == "var" {
            // Calculating variance
            if gene_counts.clone().variance().is_nan() == true {
            } else if filter_extreme_values == true && keep_cpm_bool == true && keep_total_bool == true {
                gene_infos.push(GeneInfo {
                    rank_type: gene_counts.variance(),
                    gene_symbol: gene_names[row].clone(),
                });
            } else if filter_extreme_values == false {
                gene_infos.push(GeneInfo {
                    rank_type: gene_counts.variance(),
                    gene_symbol: gene_names[row].clone(),
                });
            }
        } else {
            // Calculating interquartile region
            let mut gene_counts_data = Data::new(gene_counts);
            if gene_counts_data.clone().interquartile_range().is_nan() == true {
            } else if filter_extreme_values == true && keep_cpm_bool == true && keep_total_bool == true {
                gene_infos.push(GeneInfo {
                    rank_type: gene_counts_data.interquartile_range(),
                    gene_symbol: gene_names[row].clone(),
                });
            } else if filter_extreme_values == false {
                gene_infos.push(GeneInfo {
                    rank_type: gene_counts_data.interquartile_range(),
                    gene_symbol: gene_names[row].clone(),
                });
            }
        }
    }
    gene_infos
        .as_mut_slice()
        .sort_by(|a, b| (a.rank_type).partial_cmp(&b.rank_type).unwrap_or(Ordering::Equal));
    gene_infos
}

fn cpm(
    input_matrix: &Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>>,
) -> Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>> {
    //let mut blank = Vec::<f64>::new();
    let mut blank = Vec::with_capacity(input_matrix.nrows() * input_matrix.ncols());
    for _i in 0..input_matrix.nrows() * input_matrix.ncols() {
        blank.push(0.0);
    }
    let mut output_matrix = DMatrix::from_vec(input_matrix.nrows(), input_matrix.ncols(), blank);
    let column_sums = input_matrix.row_sum();
    for col in 0..input_matrix.ncols() {
        let norm_factor = column_sums[(0, col)];
        for row in 0..input_matrix.nrows() {
            output_matrix[(row, col)] = (input_matrix[(row, col)] as f64 * 1000000.0) / norm_factor as f64;
        }
    }
    //println!("output_matrix:{:?}", output_matrix);
    output_matrix
}

fn main() {
    // println!("Starting gene variance calculation...");
    let mut input = String::new();
    match io::stdin().read_line(&mut input) {
        // Accepting the piped input from nodejs (or command line from testing)
        Ok(_bytes_read) => {
            // eprintln!("Read {} bytes from stdin", bytes_read);
            // println!("{} bytes read", bytes_read);
            // println!("{}", input);
            let input_json = json::parse(&input);
            match input_json {
                Ok(json_string) => {
                    // println!("Successfully parsed JSON input");
                    // let now = Instant::now();
                    let samples_string_result = &json_string["samples"].to_owned();
                    let samples_string;
                    match samples_string_result.as_str() {
                        Some(x) => {
                            samples_string = x.to_string();
                            // println!("Samples: {}", samples_string);
                        }
                        None => {
                            // eprintln!("ERROR: Samples not provided in JSON");
                            println!(
                                "{}",
                                serde_json::json!({
                                    "status": "error",
                                    "message": "Samples not provided"
                                })
                            );
                            return;
                        }
                    }

                    let file_name_result = &json_string["input_file"];
                    let file_name;

                    match file_name_result.as_str() {
                        Some(x) => {
                            file_name = x.to_string();
                            // eprintln!("Input file: {}", file_name);
                            // Return file name as JSON for debugging
                            // println!(
                            //     "{}",
                            //     serde_json::json!({"status": "success", "file_name": file_name})
                            // );
                        }
                        None => {
                            // eprintln!("ERROR: File name missing in JSON");
                            // println!(
                            //     "{}",
                            //     serde_json::json!({
                            //         "status": "error",
                            //         "message": "File name is missing"
                            //     })
                            // );
                            return;
                        }
                    }

                    // Determine file type based on extension
                    let file_type: String;
                    if file_name.to_lowercase().ends_with(".h5") {
                        file_type = "hdf5".to_string();
                        // eprintln!("Detected HDF5 file format based on .h5 extension");
                    } else {
                        file_type = "text".to_string();
                        // eprintln!("Using default text file format (no .h5 extension found)");
                    }

                    // Determine if the H5 file is new format
                    let new_format: bool = match &json_string {
                        json::JsonValue::Object(ref obj) => {
                            obj.get("newformat").and_then(|v| v.as_bool()).map_or(false, |b| b)
                        }
                        _ => false,
                    };

                    let rank_type = &json_string["rank_type"] // Value provide must be either "var" or "iqr"
                        .to_owned()
                        .as_str()
                        .unwrap_or("var")
                        .to_string();
                    // eprintln!("Rank type: {}", rank_type);
                    if rank_type != "var" && rank_type != "iqr" {
                        // Check if any unknown method has been provided
                        // eprintln!("ERROR: Unknown rank method: {}", rank_type);
                        // println!(
                        //     "{}",
                        //     serde_json::json!({
                        //         "status": "error",
                        //         "message": format!("Unknown rank method: {}. Must be 'var' or 'iqr'", rank_type)
                        //     })
                        // );
                        return;
                    }
                    let filter_extreme_values_result = &json_string["filter_extreme_values"];

                    let filter_extreme_values;
                    match filter_extreme_values_result.as_bool() {
                        Some(x) => {
                            filter_extreme_values = x;
                            // eprintln!("Filter extreme values: {}", filter_extreme_values);
                        }
                        None => {
                            filter_extreme_values = true; // If filter_extreme_values field is missing, set it to true by default
                            // eprintln!(
                            //     "Filter extreme values not specified, defaulting to: {}",
                            //     filter_extreme_values
                            // );
                        }
                    }

                    let num_genes_result = &json_string["num_genes"];
                    let num_genes;
                    match num_genes_result.as_usize() {
                        Some(x) => {
                            num_genes = x;
                            // eprintln!("Number of genes requested: {}", num_genes);
                        }
                        None => {
                            // eprintln!("ERROR: Number of genes to be given is missing");
                            println!(
                                "{}",
                                serde_json::json!({
                                    "status": "error",
                                    "message": "Number of genes to be given is missing"
                                })
                            );
                            return;
                        }
                    }

                    let min_count_result = &json_string["min_count"];
                    let mut min_count: Option<f64> = None;
                    match min_count_result.as_f64() {
                        Some(x) => {
                            min_count = Some(x);
                            // eprintln!("Min count: {}", x);
                        }
                        None => {
                            // eprintln!("Min count not specified, will use default");
                        }
                    }

                    let min_total_count_result = &json_string["min_total_count"];
                    let mut min_total_count: Option<f64> = None;
                    match min_total_count_result.as_f64() {
                        Some(x) => {
                            min_total_count = Some(x);
                            // eprintln!("Min total count: {}", x);
                        }
                        None => {
                            // eprintln!("Min total count not specified, will use default");
                        }
                    }

                    let samples_list: Vec<&str> = samples_string.split(",").collect();
                    // eprintln!("Number of samples in list: {}", samples_list.len());

                    // Choose the appropriate input function based on file type
                    // eprintln!("Reading data from {} file: {}", file_type, file_name);
                    let (input_matrix, gene_names) = if file_type == "hdf5" {
                        // eprintln!("Using HDF5 reader function...");
                        if new_format {
                            match input_data_hdf5_newformat(&file_name, &samples_list) {
                                Ok(result) => result,
                                Err(err) => {
                                    eprintln!("ERROR in HDF5 new format reader: {:?}", err);
                                    return;
                                }
                            }
                        } else {
                            match input_data_hdf5(&file_name, &samples_list) {
                                Ok(result) => {
                                    // eprintln!("Successfully read HDF5 data");
                                    result
                                }
                                Err(err) => {
                                    eprintln!("ERROR in HDF5 reader: {:?}", err);
                                    // Error has already been printed to stdout in JSON format by the function
                                    return;
                                }
                            }
                        }
                    } else {
                        // For original text-based implementation, we wrap it in a try-catch block
                        // to handle panics in a more structured way
                        // eprintln!("Using text file reader function...");
                        match std::panic::catch_unwind(|| input_data(&file_name, &samples_list)) {
                            Ok(result) => {
                                // eprintln!("Successfully read text file data");
                                result
                            }
                            Err(err) => {
                                eprintln!("ERROR in text file reader: {:?}", err);
                                println!(
                                    "{}",
                                    serde_json::json!({
                                        "status": "error",
                                        "message": "Failed to read text file data",
                                        "file_path": file_name
                                    })
                                );
                                return;
                            }
                        }
                    };

                    // eprintln!(
                    //     "Matrix dimensions: {}x{}",
                    //     input_matrix.nrows(),
                    //     input_matrix.ncols()
                    // );
                    // eprintln!("Number of gene symbols: {}", gene_names.len());
                    if !gene_names.is_empty() {
                        // eprintln!(
                        //     "First few gene symbols: {:?}",
                        //     &gene_names.iter().take(5).collect::<Vec<_>>()
                        // );
                    }

                    // Wrap the variance calculation in a try-catch to capture any panics
                    // eprintln!(
                    //     "Calculating variance with {} samples, filter={}, rank_type={}",
                    //     samples_list.len(),
                    //     filter_extreme_values,
                    //     rank_type
                    // );
                    let gene_infos = match std::panic::catch_unwind(|| {
                        calculate_variance(
                            input_matrix,
                            gene_names,
                            samples_list.len() as f64,
                            filter_extreme_values,
                            rank_type.to_string(),
                            min_count,
                            min_total_count,
                        )
                    }) {
                        Ok(result) => {
                            // eprintln!(
                            //     "Successfully calculated variance for {} genes",
                            //     result.len()
                            // );
                            result
                        }
                        Err(err) => {
                            eprintln!("ERROR in variance calculation: {:?}", err);
                            println!(
                                "{}",
                                serde_json::json!({
                                    "status": "error",
                                    "message": "Error calculating gene variance",
                                    "file_path": file_name
                                })
                            );
                            return;
                        }
                    };

                    // Check if we have enough genes for the requested output
                    if gene_infos.len() < num_genes {
                        // eprintln!(
                        //     "WARNING: Only {} genes found, but {} were requested",
                        //     gene_infos.len(),
                        //     num_genes
                        // );
                    }

                    let actual_num_genes = std::cmp::min(num_genes, gene_infos.len());
                    // eprintln!("Returning top {} genes", actual_num_genes);

                    // Printing the top "num_genes" genes to JSON
                    let mut output_string = "[".to_string();
                    for j in 0..actual_num_genes {
                        let i = gene_infos.len() - j - 1;
                        output_string += &serde_json::to_string(&gene_infos[i]).unwrap();
                        if i > gene_infos.len() - actual_num_genes {
                            output_string += &",".to_string();
                        }
                    }
                    output_string += &"]".to_string();

                    // Debug the first few characters of the output
                    if output_string.len() > 100 {
                        // eprintln!("Output JSON starts with: {}", &output_string[0..100]);
                    } else {
                        // eprintln!("Output JSON: {}", output_string);
                    }

                    println!("output_json:{}", output_string);
                    // let elapsed = now.elapsed();
                    // eprintln!("Completed in: {:?}", elapsed);
                    // println!("Time for calculating variances:{:?}", elapsed);
                }
                Err(error) => {
                    eprintln!("ERROR: JSON parsing error: {}", error);
                    println!(
                        "{}",
                        serde_json::json!({
                            "status": "error",
                            "message": format!("Incorrect json: {}", error)
                        })
                    );
                }
            }
        }
        Err(error) => {
            eprintln!("ERROR: Failed to read from stdin: {}", error);
            println!(
                "{}",
                serde_json::json!({
                "status": "error",
                "message": format!("Piping error: {}", error)
                })
            );
        }
    }
    // println!("Program execution complete");
}
