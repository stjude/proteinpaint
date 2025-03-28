// Need to set HDF5_DIR and LD_LIBRARY_PATH in ~/.bash_profile
// Syntax: HDF5_DIR=/usr/local/Homebrew/Cellar/hdf5/1.14.3_1 && echo $HDF5_DIR && cd .. && cargo build --release && json='{"gene":"TP53","hdf5_file":"matrix_with_na_comp_9.h5"}' && time echo $json | target/release/rust_hdf5

// Imports
use hdf5::types::{FixedAscii, VarLenAscii};
use hdf5::{File, Result};
use ndarray::Dim;
use ndarray::{Array1, s};
use serde_json::{Map, Value, json};
use std::io;
use std::time::Instant;

/// Determines the format of an HDF5 gene expression file
///
/// This function examines the structure of an HDF5 file to determine its format.
/// It detects whether the file uses a dense matrix representation, a sparse matrix
/// representation, or an unknown format by checking for the presence of specific
/// datasets and groups.
///
/// # HDF5 Format Specifications
///
/// The function identifies the following formats:
///
/// - **Dense format**:
///   - Contains a "counts" dataset (2D matrix of gene expression values)
///   - Contains a "gene_names" dataset (gene identifiers)
///   - Contains a "samples" dataset (sample identifiers)
///
/// - **Sparse format**:
///   - Contains a "data" group with sparse matrix components
///   - Contains a "sample_names" dataset
///
/// - **Unknown format**:
///   - Does not match either the dense or sparse format criteria
///
/// # Arguments
///
/// * `hdf5_filename` - Path to the HDF5 file to analyze
///
/// # Returns
///
/// A result containing one of the following static string values:
/// - `"dense"` - If the file is in dense matrix format
/// - `"sparse"` - If the file is in sparse matrix format
/// - `"unknown"` - If the file format cannot be determined
///
/// # Errors
///
/// This function will return an error if:
/// - The file cannot be opened
/// - The file is not a valid HDF5 file
///
/// # Algorithm
///
/// The detection algorithm works by checking for the presence of specific datasets
/// and groups that are characteristic of each format:
///
/// 1. Opens the HDF5 file
/// 2. Checks for datasets/groups that indicate dense format
/// 3. Checks for datasets/groups that indicate sparse format
/// 4. Returns the detected format or "unknown"
///
/// # Examples
///
/// ```rust
/// // Example usage (not runnable)
/// match detect_hdf5_format("expression_data.h5") {
///     Ok("dense") => println!("Dense format detected"),
///     Ok("sparse") => println!("Sparse format detected"),
///     Ok("unknown") => println!("Unknown format detected"),
///     Err(e) => println!("Error: {}", e),
/// }
/// ```
fn detect_hdf5_format(hdf5_filename: &str) -> Result<&'static str> {
    let file = File::open(hdf5_filename)?;

    // Check for dense format (has counts, gene_names, and samples datasets)
    let has_counts = file.dataset("counts").is_ok();
    let has_gene_names = file.dataset("gene_names").is_ok();
    let has_samples = file.dataset("samples").is_ok();

    // Check for sparse matrix format (has data group and sample_names)
    let has_data_group = file.group("data").is_ok();
    let has_sample_names = file.dataset("sample_names").is_ok();

    if has_counts && has_gene_names && has_samples {
        // eprintln!("Dense format detected");
        Ok("dense")
    } else if has_data_group && has_sample_names {
        //eprintln!("Sparse format detected");
        Ok("sparse")
    } else {
        eprintln!("Unknown format detected");
        Ok("unknown")
    }
}

/// Unified function for querying gene expression data from any supported HDF5 file format
///
/// This function serves as the central entry point for extracting expression values for a specified gene
/// from an HDF5 file. It automatically detects the format of the provided file (dense or sparse)
/// and routes the query to the appropriate specialized handler function.
///
/// # Supported HDF5 Formats
///
/// - **Dense format**: Contains explicit "gene_ids", "samples", and "counts" datasets where
///   the expression matrix is stored as a direct 2D array
/// - **Sparse format**: Contains a "data" group with "p", "i", "x" datasets using the
///   Compressed Sparse Column (CSC) representation for the expression matrix
///
/// # Arguments
///
/// * `hdf5_filename` - Path to the HDF5 file containing gene expression data
/// * `gene_name` - Name of the gene whose expression values to extract
///
/// # Returns
///
/// A result indicating success or error. On success, the function prints the gene
/// expression data in JSON format to stdout for dense matrix HDF5 files. For spare matrix files it
/// sends the expression data in JSON format with "output_string:" prefix to stdout.
///
/// # Example Output Format
///
/// ```json
/// {
///   "gene": "TP53",
///   "dataId": "TP53",
///   "samples": {
///     "sample1": 10.5,
///     "sample2": 8.2,
///     "sample3": 15.7
///   }
/// }
/// ```
///
/// # Error Handling
///
/// The function handles several types of errors:
/// - File format detection failures
/// - Unsupported or unknown file formats
/// - Errors from the format-specific query functions
///
/// When an error occurs, the function returns a structured JSON error message.
///
/// # Processing Flow
///
/// 1. Detects the format of the HDF5 file using `detect_hdf5_format`
/// 2. Routes to the appropriate specialized function:
///    - `query_gene_dense` for dense matrix files
///    - `query_gene_sparse` for sparse matrix files
/// 3. Returns an error for unsupported formats
///
/// This unified approach allows client code to work with either format without needing
/// to know the specific structure of the underlying HDF5 file.
fn query_gene(hdf5_filename: String, gene_name: String) -> Result<()> {
    // First, detect the file format
    let file_format = detect_hdf5_format(&hdf5_filename)?;

    // Query gene data based on format
    match file_format {
        "dense" => query_gene_dense(hdf5_filename, gene_name),
        "sparse" => query_gene_sparse(hdf5_filename, gene_name),
        _ => {
            // For unknown format, return an error
            println!(
                "{}",
                serde_json::json!({
                    "status": "failure",
                    "message": "Cannot query gene in unknown file format. Please use .h5 format in either sparse or dense format.",
                    "file_path": hdf5_filename,
                    "gene": gene_name,
                    "format": "unknown"
                })
            );
            Ok(())
        }
    }
}

/// Reads expression data for a specific gene from a dense format HDF5 file
///
/// This function extracts expression values for a specified gene from an HDF5 file
/// that follows the dense matrix format. The dense format is characterized by:
/// - A "gene_ids" dataset containing gene identifiers
/// - A "samples" dataset containing sample identifiers
/// - A "counts" dataset containing a gene × sample expression matrix
///
/// The function returns the expression values in a JSON format where sample names
/// are keys and their corresponding expression values are the values.
///
/// # Arguments
///
/// * `hdf5_filename` - Path to the HDF5 file
/// * `gene_name` - Name of the gene to query
///
/// # Returns
///
/// A result indicating success or error. On success, the function prints the gene
/// expression data in JSON format to stdout.
///
/// # Output Format
///
/// ```json
/// {
///   "gene": "GENE_NAME",
///   "dataId": "GENE_NAME",
///   "samples": {
///     "SAMPLE1": VALUE1,
///     "SAMPLE2": VALUE2,
///     ...
///   }
/// }
/// ```
///
/// # Error Handling
///
/// The function handles several potential errors:
/// - File opening errors
/// - Missing or inaccessible datasets ("gene_ids", "samples", "counts")
/// - Gene not found in the dataset
/// - Out of bounds gene index
/// - Expression data reading failures
///
/// If an error occurs, the function returns an explanatory error message in JSON format.
///
/// # Reading Strategy
///
/// The function tries two methods to read expression data:
/// 1. First attempts to read a 1D slice directly from the counts dataset
/// 2. If that fails, tries reading the entire dataset and extracting the row of interest
///
/// This dual approach ensures compatibility with different HDF5 library implementations
/// and dataset configurations.
fn query_gene_dense(hdf5_filename: String, gene_name: String) -> Result<()> {
    // let start_time = Instant::now();

    // Open the HDF5 file
    let file = match File::open(hdf5_filename) {
        Ok(f) => f,
        Err(err) => {
            println!(
                "{}",
                serde_json::json!({
                    "status": "error",
                    "message": format!("Failed to open HDF5 file: {}", err)
                })
            );
            return Ok(());
        }
    };

    // Read gene ids using VarLenAscii
    let genes_dataset = match file.dataset("gene_ids") {
        Ok(ds) => ds,
        Err(err) => {
            println!(
                "{}",
                serde_json::json!({
                    "status": "error",
                    "message": format!("Failed to open gene_ids dataset {}", err)
                })
            );
            return Ok(());
        }
    };

    // Read genes as VarLenAscii
    let genes_varlen = match genes_dataset.read_1d::<VarLenAscii>() {
        Ok(g) => g,
        Err(err) => {
            println!(
                "{}",
                serde_json::json!({
                    "status": "error",
                    "message": format!("Failed to read gene names as VarLenAscii: {}", err)
                })
            );
            return Ok(());
        }
    };

    // Convert to Vec<String> for easier handling
    let genes: Vec<String> = genes_varlen.iter().map(|g| g.to_string()).collect();

    // Read sample names using VarLenAscii
    let samples_dataset = match file.dataset("samples") {
        Ok(ds) => ds,
        Err(err) => {
            println!(
                "{}",
                serde_json::json!({
                    "status": "error",
                    "message": format!("Failed to open samples dataset{}", err)
                })
            );
            return Ok(());
        }
    };

    // Read samples as VarLenAscii
    let samples_varlen = match samples_dataset.read_1d::<VarLenAscii>() {
        Ok(s) => s,
        Err(err) => {
            println!(
                "{}",
                serde_json::json!({
                    "status": "error",
                    "message": format!("Failed to read samples as VarLenAscii: {}", err)
                })
            );
            return Ok(());
        }
    };

    // Convert to Vec<String> for easier handling
    let samples: Vec<String> = samples_varlen.iter().map(|s| s.to_string()).collect();

    // Find the index of the requested gene
    let gene_index = match genes.iter().position(|x| *x == gene_name) {
        Some(index) => index,
        None => {
            println!(
                "{}",
                serde_json::json!({
                    "status": "error",
                    "message": format!("Gene '{}' not found in the dataset", gene_name)
                })
            );
            return Ok(());
        }
    };

    // Read the expression data for the gene
    let counts_dataset = match file.dataset("counts") {
        Ok(ds) => ds,
        Err(err) => {
            println!(
                "{}",
                serde_json::json!({
                    "status": "error",
                    "message": format!("Failed to open counts dataset: {}", err)
                })
            );
            return Ok(());
        }
    };

    // Make sure the gene index is valid for this dataset
    if gene_index >= counts_dataset.shape()[0] {
        println!(
            "{}",
            serde_json::json!({
                "status": "error",
                "message": "Gene index is out of bounds for the dataset"
            })
        );
        return Ok(());
    }

    // Try to read the expression data
    let gene_expression: Array1<f64>;

    // Method 1: Try to read a 1D slice directly (for 2D datasets)
    match counts_dataset.read_slice_1d::<f64, _>(s![gene_index, ..]) {
        Ok(data) => {
            gene_expression = data;
        }
        Err(err1) => {
            // Method 2: Try a different approach

            // First get the dimensions
            let dataset_shape = counts_dataset.shape();
            if dataset_shape.len() != 2 {
                println!(
                    "{}",
                    serde_json::json!({
                        "status": "error",
                        "message": "Expected a 2D dataset for counts"
                    })
                );
                return Ok(());
            }

            // Try reading the entire dataset and then extracting the row
            match counts_dataset.read::<f64, Dim<[usize; 2]>>() {
                Ok(all_data) => {
                    // Extract just the row we need
                    let row = all_data.slice(s![gene_index, ..]).to_owned();
                    gene_expression = row;

                    // Start building a flatter JSON structure
                    let mut output_string = String::from("{\"samples\":{");

                    // Create direct key-value pairs where sample names are the keys
                    for i in 0..gene_expression.len() {
                        // Add each sample name as a key pointing directly to its expression value
                        output_string += &format!(
                            "\"{}\":{}",
                            samples[i].to_string(),
                            gene_expression[i].to_string()
                        );

                        // Add comma if not the last item
                        if i < gene_expression.len() - 1 {
                            output_string += ",";
                        }
                    }

                    // Close the JSON object
                    output_string += "}}";

                    // println!("{}", output_string);
                }
                Err(err2) => {
                    println!(
                        "{}",
                        serde_json::json!({
                            "status": "error",
                            "message": format!("Failed to read expression values: {:?}, {:?}", err1, err2)
                        })
                    );
                    return Ok(());
                }
            }
        }
    }
    // Create samples map
    let mut samples_map = Map::new();
    for (i, sample) in samples.iter().enumerate() {
        if i < gene_expression.len() {
            // Add each sample to the map, clean the sample name and convert value to JSON Number
            // Note: We need to handle potential NaN or infinity values that aren't valid in JSON
            let value = if gene_expression[i].is_finite() {
                Value::from(gene_expression[i])
            } else {
                Value::Null // Or choose a different representation for non-finite values
            };

            samples_map.insert(
                sample.replace("\\", ""), // Clean the sample name
                value,
            );
        }
    }

    // Build the complete JSON structure
    let output_json = json!({
        "gene": gene_name,
        "dataId": gene_name,
        "samples": samples_map
    });

    // Output the JSON directly
    println!("{}", output_json);

    Ok(())
}

/// Reads expression data for a specific gene from a sparse format HDF5 file (from original readHD5.rs)
///
/// This function extracts expression values for a specified gene from an HDF5 file
/// that uses a sparse matrix representation. Sparse matrices are efficient for storing
/// genomic data where many genes have zero expression in many samples. The sparse
/// format follows the Compressed Sparse Column (CSC) structure with:
///
/// - A "data/dim" dataset containing matrix dimensions
/// - A "gene_names" dataset containing gene identifiers
/// - A "sample_names" dataset containing sample identifiers
/// - A "data/p" dataset containing pointers to where each gene's data starts and ends
/// - A "data/i" dataset containing column indices for non-zero values
/// - A "data/x" dataset containing the actual non-zero expression values
///
/// # Arguments
///
/// * `hdf5_filename` - Path to the HDF5 file
/// * `gene_name` - Name of the gene to query
///
/// # Returns
///
/// A result indicating success or error. On success, the function prints the gene
/// expression data in JSON format to stdout with "output_string:" prefix.
///
/// # Output Format
///
/// The function outputs a JSON object where sample names are keys and their
/// corresponding expression values are the values:
///
/// ```json
/// {
///   "sample1": 0.0,
///   "sample2": 4.5,
///   "sample3": 0.0,
///   "sample4": 7.2,
///   ...
/// }
/// ```
///
/// # Algorithm
///
/// 1. Opens the HDF5 file and reads matrix dimensions
/// 2. Reads gene and sample names
/// 3. Finds the index of the requested gene
/// 4. Reads the sparse representation:
///    - Gets pointers from "data/p" to determine which values belong to the gene
///    - Reads column indices from "data/i" to know which samples have non-zero values
///    - Reads actual values from "data/x"
/// 5. Reconstructs a dense vector from the sparse representation
/// 6. Formats and outputs the result as JSON
///
/// # Performance Tracking
///
/// The function tracks performance at various stages using timestamps:
/// - Time spent parsing genes
/// - Time spent parsing samples
/// - Time spent reading the p, i, and x datasets
/// - Time spent generating the full array from sparse representation
///
/// # Error Handling
///
/// The function handles several potential errors:
/// - File opening failures
/// - Dataset access failures
/// - Gene not found in the dataset
/// - Sparse matrix reading failures
///
/// If an error occurs, the function returns a structured JSON error message.
fn query_gene_sparse(hdf5_filename: String, gene_name: String) -> Result<()> {
    let file = File::open(&hdf5_filename)?;
    let ds_dim = file.dataset("data/dim")?;

    // Check the data type and read the dataset accordingly
    let data_dim: Array1<_> = ds_dim.read::<usize, Dim<[usize; 1]>>()?;
    let num_samples = data_dim[0]; // Number of total columns in the dataset
    let num_genes = data_dim[1];
    println!("num_samples:{}", num_samples);
    println!("num_genes:{}", num_genes);

    let now_genes = Instant::now();
    let ds_genes = file.dataset("gene_names")?;
    let genes = ds_genes.read_1d::<FixedAscii<104>>()?;
    println!("Time for parsing genes:{:?}", now_genes.elapsed());

    let now_samples = Instant::now();
    let ds_samples = file.dataset("sample_names")?;
    let samples = ds_samples.read_1d::<FixedAscii<104>>()?;
    println!("Time for parsing samples:{:?}", now_samples.elapsed());

    let gene_index = match genes.iter().position(|&x| x == gene_name) {
        Some(index) => {
            println!(
                "The index of '{}' is {} in 0-based format (add 1 to compare with R output)",
                gene_name, index
            );
            index
        }
        None => {
            println!(
                "{}",
                serde_json::json!({
                    "status": "failure",
                    "message": format!("Gene '{}' not found in the HDF5 file '{}'", gene_name, &hdf5_filename),
                    "file_path": hdf5_filename,
                    "gene": gene_name
                })
            );
            return Ok(());
        }
    };

    // Find the number of columns that are populated for that gene
    let now_p = Instant::now();
    let ds_p = file.dataset("data/p")?;
    let data_partial_p: Array1<usize> = ds_p.read_slice_1d(gene_index..gene_index + 2)?;
    println!("Data_partial_p: {:?}", data_partial_p);
    println!("Time for p dataset:{:?}", now_p.elapsed());

    let array_start_point = data_partial_p[0];
    let array_stop_point = data_partial_p[1];
    let num_populated_cells = array_stop_point - array_start_point;
    println!("Number of populated cells:{}", num_populated_cells);

    // Find all columns indices that are populated for the given gene
    let now_i = Instant::now();
    let ds_i = file.dataset("data/i")?;
    let populated_column_ids: Array1<usize> =
        ds_i.read_slice_1d(array_start_point..array_stop_point)?;
    println!("Time for i dataset:{:?}", now_i.elapsed());

    // Find all columns values that are populated for the given gene
    let now_x = Instant::now();
    let ds_x = file.dataset("data/x")?;
    let populated_column_values: Array1<f64> =
        ds_x.read_slice_1d(array_start_point..array_stop_point)?;
    println!("Time for x dataset:{:?}", now_x.elapsed());

    // Generate the complete array from the sparse array
    let mut gene_array: Array1<f64> = Array1::zeros(num_samples);
    let time_generating_full_array = Instant::now();

    // Fill in the values at the populated column indices
    for (idx, &col_id) in populated_column_ids.iter().enumerate() {
        gene_array[col_id] = populated_column_values[idx];
    }

    // Format output as JSON
    let mut output_string = "{".to_string();
    for i in 0..gene_array.len() {
        output_string += &format!(
            "\"{}\":{}",
            samples[i].to_string().replace("\\", ""),
            gene_array[i].to_string()
        );

        if i != gene_array.len() - 1 {
            output_string += &",";
        }
    }
    output_string += &"}".to_string();

    println!(
        "Time generating full array:{:?}",
        time_generating_full_array.elapsed()
    );
    println!("output_string:{}", output_string);

    Ok(())
}

// Main function
fn main() -> Result<()> {
    let mut input = String::new();
    match io::stdin().read_line(&mut input) {
        Ok(_bytes_read) => {
            let input_json = json::parse(&input);
            match input_json {
                Ok(json_string) => {
                    // Extract HDF5 filename
                    let hdf5_filename = match json_string["hdf5_file"].as_str() {
                        Some(x) => x.to_string(),
                        None => {
                            panic!("HDF5 filename not provided");
                        }
                    };

                    // Then, check if we have a gene to query
                    if let Some(gene_name) = json_string["gene"].as_str() {
                        // let gene_query_time = Instant::now();
                        query_gene(hdf5_filename, gene_name.to_string())?;
                        // println!("Time for querying gene: {:?}", gene_query_time.elapsed());
                    }
                }
                Err(error) => println!("Incorrect json: {}", error),
            }
        }
        Err(error) => println!("Piping error: {}", error),
    }
    Ok(())
}
