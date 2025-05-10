//------------------------------------------------------------------------------
// readHDF5.rs - HDF5 Gene Expression Data Reader
//------------------------------------------------------------------------------
//
// Extracts gene expression values from HDF5 files in dense or sparse formats.
// Supports single genes with memory optimization and multiple genes with
// parallel processing.
//
// Features:
// - Auto format detection (dense/sparse)
// - Optimized single and multi-gene queries
// - Parallel processing for multiple genes
// - JSON output with timing metrics
//
// Usage:
//   HDF5_DIR=/usr/local/Homebrew/Cellar/hdf5/1.14.3_1 &&
//   echo $json='{"gene":"TP53","hdf5_file":"matrix.h5"}' | target/release/readHDF5
//------------------------------------------------------------------------------
use hdf5::types::{FixedAscii, VarLenAscii};
use hdf5::{File, Result};
use ndarray::Dim;
use ndarray::{s, Array1};
use rayon::prelude::*;
use serde_json::{json, Map, Value};
use std::io;
use std::sync::Arc;
use std::time::Instant;

/// Determines the format of an HDF5 gene expression file
///
/// Examines the structure of an HDF5 file to detect its format:
/// - "dense": Contains "counts", "gene_names", and "samples" datasets
/// - "sparse": Contains "data" group and "sample_names" dataset
/// - "unknown": Does not match either format
///
/// # Arguments
/// * `hdf5_filename` - Path to the HDF5 file to analyze
///
/// # Returns
/// The detected format as a static string: "dense", "sparse", or "unknown"
fn detect_hdf5_format(hdf5_filename: &str) -> Result<&'static str> {
    panic!("Something went wrong");
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

/// Unified function for querying gene expression data from an HDF5 file
///
/// Automatically detects file format (dense or sparse) and routes to the appropriate handler.
///
/// # Arguments
/// * `hdf5_filename` - Path to the HDF5 file containing gene expression data
/// * `gene_name` - Name of the gene whose expression values to extract
///
/// # Returns
/// Outputs gene expression data in JSON format to stdout
fn query_gene(hdf5_filename: String, gene_name: String) -> Result<()> {
    // First, detect the file format
    let file_format = detect_hdf5_format(&hdf5_filename)?;

    // Query gene data based on format
    match file_format {
        "dense" => query_gene_dense(hdf5_filename, gene_name),
        "sparse" => query_gene_sparse(hdf5_filename, gene_name),
        _ => {
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
/// Dense format contains "gene_ids", "samples", and "counts" datasets.
///
/// # Arguments
/// * `hdf5_filename` - Path to the HDF5 file
/// * `gene_name` - Name of the gene to query
///
/// # Returns
/// Prints gene expression data in JSON format to stdout
///
/// # Error Handling
/// Handles file access issues, missing datasets, and gene not found scenarios
fn query_gene_dense(hdf5_filename: String, gene_name: String) -> Result<()> {
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

    let gene_expression: Array1<f64>;

    // Method 1: Try to read a 1D slice directly (for 2D datasets)
    match counts_dataset.read_slice_1d::<f64, _>(s![gene_index, ..]) {
        Ok(data) => {
            gene_expression = data;
        }
        Err(err1) => {
            // Method 2: Try a different approach
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

                    let mut output_string = String::from("{\"samples\":{");

                    // Create direct key-value pairs where sample names are the keys
                    for i in 0..gene_expression.len() {
                        // Add each sample name as a key pointing directly to its expression value
                        output_string += &format!("\"{}\":{}", samples[i].to_string(), gene_expression[i].to_string());

                        // Add comma if not the last item
                        if i < gene_expression.len() - 1 {
                            output_string += ",";
                        }
                    }

                    // Close the JSON object
                    output_string += "}}";
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
    let mut samples_map = Map::new();
    for (i, sample) in samples.iter().enumerate() {
        if i < gene_expression.len() {
            let value = if gene_expression[i].is_finite() {
                Value::from(gene_expression[i])
            } else {
                Value::Null
            };

            samples_map.insert(sample.replace("\\", ""), value);
        }
    }

    let output_json = json!({
        "gene": gene_name,
        "dataId": gene_name,
        "samples": samples_map
    });

    // Output the JSON directly
    println!("{}", output_json);

    Ok(())
}

/// Reads expression data for a specific gene from a sparse format HDF5 file
///
/// Extracts expression values from sparse matrix HDF5 files using Compressed
/// Sparse Column (CSC) structure.
///
/// # Arguments
/// * `hdf5_filename` - Path to the HDF5 file
/// * `gene_name` - Name of the gene to query
///
/// # Returns
/// Prints gene expression data as JSON to stdout with "output_string:" prefix.
/// Sample names are keys, expression values are values.
///
/// The sparse format includes:
/// - "data/dim" - Matrix dimensions
/// - "gene_names" - Gene identifiers
/// - "sample_names" - Sample identifiers
/// - "data/p", "data/i", "data/x" - CSC matrix components
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
    let populated_column_ids: Array1<usize> = ds_i.read_slice_1d(array_start_point..array_stop_point)?;
    println!("Time for i dataset:{:?}", now_i.elapsed());

    // Find all columns values that are populated for the given gene
    let now_x = Instant::now();
    let ds_x = file.dataset("data/x")?;
    let populated_column_values: Array1<f64> = ds_x.read_slice_1d(array_start_point..array_stop_point)?;
    println!("Time for x dataset:{:?}", now_x.elapsed());

    // Generate the complete array from the sparse array
    let mut gene_array: Array1<f64> = Array1::zeros(num_samples);
    let time_generating_full_array = Instant::now();

    // Fill in the values at the populated column indices
    for (idx, &col_id) in populated_column_ids.iter().enumerate() {
        gene_array[col_id] = populated_column_values[idx];
    }

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

    println!("Time generating full array:{:?}", time_generating_full_array.elapsed());
    println!("output_string:{}", output_string);

    Ok(())
}

/// Queries expression data for multiple genes from a dense format HDF5 file
///
/// Extracts expression values for multiple genes from a dense matrix HDF5 file,
/// optimizing for both single gene (linear search) and multi-gene (hashmap) queries.
///
/// # Arguments
/// * `hdf5_filename` - Path to the HDF5 file
/// * `gene_names` - Vector of gene names to query
///
/// # Returns
/// Prints a JSON object with expression data for all requested genes to stdout.
fn query_multiple_genes_dense(hdf5_filename: String, gene_names: Vec<String>) -> Result<()> {
    let overall_start_time = Instant::now();

    // Create timing map to store all timing data
    let mut timings = Map::new();

    let file = match File::open(&hdf5_filename) {
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

    let genes_dataset = match file.dataset("gene_ids") {
        Ok(ds) => ds,
        Err(err) => {
            println!(
                "{}",
                serde_json::json!({
                    "status": "error",
                    "message": format!("Failed to open gene_ids dataset: {}", err)
                })
            );
            return Ok(());
        }
    };

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

    let genes: Vec<String> = genes_varlen.iter().map(|g| g.to_string()).collect();

    // Only create HashMap for multiple gene queries
    let gene_to_index: Option<std::collections::HashMap<String, usize>> = if gene_names.len() > 1 {
        let hashmap_start_time = Instant::now();
        let mut map = std::collections::HashMap::with_capacity(genes.len());
        for (idx, gene) in genes.iter().enumerate() {
            map.insert(gene.clone(), idx);
        }
        timings.insert(
            "build_hashmap_ms".to_string(),
            Value::from(hashmap_start_time.elapsed().as_millis() as u64),
        );
        Some(map)
    } else {
        // Skip HashMap creation for single gene queries
        None
    };

    let samples_dataset = match file.dataset("samples") {
        Ok(ds) => ds,
        Err(err) => {
            println!(
                "{}",
                serde_json::json!({
                    "status": "error",
                    "message": format!("Failed to open samples dataset: {}", err)
                })
            );
            return Ok(());
        }
    };

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

    let samples: Vec<String> = samples_varlen.iter().map(|s| s.to_string()).collect();

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

    // Create thread-local storage for results
    let genes_map = Arc::new(std::sync::Mutex::new(Map::new()));
    let gene_timings = Arc::new(std::sync::Mutex::new(Map::new()));

    if gene_names.len() > 1 {
        // For multiple genes: preload all data and use parallel processing
        timings.insert("parallel_processing".to_string(), Value::from(true));

        // Load all gene data upfront only when processing multiple genes
        let all_data_start_time = Instant::now();
        let all_gene_data = match counts_dataset.read::<f64, Dim<[usize; 2]>>() {
            Ok(data) => {
                timings.insert(
                    "read_all_gene_data_ms".to_string(),
                    Value::from(all_data_start_time.elapsed().as_millis() as u64),
                );
                Some(data)
            }
            Err(err) => {
                // Failed to read all data at once, will fallback to per-gene reading
                timings.insert(
                    "read_all_gene_data_error".to_string(),
                    Value::String(format!("{:?}", err)),
                );
                None
            }
        };

        // Configurable thread count for testing
        let thread_count = 2;
        timings.insert("thread_count".to_string(), Value::from(thread_count));

        // Create a scoped thread pool with specified number of threads
        match rayon::ThreadPoolBuilder::new().num_threads(thread_count).build() {
            Ok(pool) => {
                // Use the pool for this specific work
                pool.install(|| {
                    gene_names.par_iter().for_each(|gene_name| {
                        let gene_start_time = Instant::now();

                        // Use HashMap for O(1) lookup for multiple genes
                        let gene_index = match &gene_to_index {
                            Some(map) => map.get(gene_name).cloned(),
                            None => genes.iter().position(|x| *x == *gene_name),
                        };

                        match gene_index {
                            Some(gene_index) => {
                                // Make sure the gene index is valid for this dataset
                                if gene_index >= counts_dataset.shape()[0] {
                                    let mut error_map = Map::new();
                                    error_map.insert(
                                        "error".to_string(),
                                        Value::String("Gene index out of bounds".to_string()),
                                    );

                                    // Store the error result
                                    let mut genes_map = genes_map.lock().unwrap();
                                    genes_map.insert(gene_name.clone(), Value::Object(error_map));
                                } else {
                                    // Use pre-loaded data if available
                                    if let Some(ref all_data) = all_gene_data {
                                        // Extract the row directly from pre-loaded data
                                        let gene_expression = all_data.slice(s![gene_index, ..]);

                                        // Create samples map for this gene
                                        let mut samples_map = Map::new();
                                        for (i, sample) in samples.iter().enumerate() {
                                            if i < gene_expression.len() {
                                                // Handle potential NaN or infinity values
                                                let value = if gene_expression[i].is_finite() {
                                                    Value::from(gene_expression[i])
                                                } else {
                                                    Value::Null
                                                };

                                                samples_map.insert(sample.replace("\\", ""), value);
                                            }
                                        }

                                        // Create gene data and store it
                                        let gene_data = json!({
                                            "dataId": gene_name,
                                            "samples": samples_map
                                        });

                                        let mut genes_map = genes_map.lock().unwrap();
                                        genes_map.insert(gene_name.clone(), gene_data);
                                    } else {
                                        // Fallback to per-gene reading if bulk load failed
                                        match counts_dataset.read_slice_1d::<f64, _>(s![gene_index, ..]) {
                                            Ok(gene_expression) => {
                                                // Create samples map for this gene
                                                let mut samples_map = Map::new();
                                                for (i, sample) in samples.iter().enumerate() {
                                                    if i < gene_expression.len() {
                                                        // Handle potential NaN or infinity values
                                                        let value = if gene_expression[i].is_finite() {
                                                            Value::from(gene_expression[i])
                                                        } else {
                                                            Value::Null
                                                        };

                                                        samples_map.insert(sample.replace("\\", ""), value);
                                                    }
                                                }

                                                // Create gene data and store it
                                                let gene_data = json!({
                                                    "dataId": gene_name,
                                                    "samples": samples_map
                                                });

                                                let mut genes_map = genes_map.lock().unwrap();
                                                genes_map.insert(gene_name.clone(), gene_data);
                                            }
                                            Err(err1) => {
                                                let mut error_map = Map::new();
                                                error_map.insert(
                                                    "error".to_string(),
                                                    Value::String(format!(
                                                        "Failed to read expression values: {:?}",
                                                        err1
                                                    )),
                                                );

                                                let mut genes_map = genes_map.lock().unwrap();
                                                genes_map.insert(gene_name.clone(), Value::Object(error_map));
                                            }
                                        }
                                    }
                                }
                            }
                            None => {
                                // Gene not found
                                let mut error_map = Map::new();
                                error_map.insert(
                                    "error".to_string(),
                                    Value::String("Gene not found in dataset".to_string()),
                                );

                                let mut genes_map = genes_map.lock().unwrap();
                                genes_map.insert(gene_name.clone(), Value::Object(error_map));
                            }
                        }

                        // Record timing
                        let elapsed_time = gene_start_time.elapsed().as_millis() as u64;
                        let mut gene_timings = gene_timings.lock().unwrap();
                        gene_timings.insert(gene_name.clone(), Value::from(elapsed_time));
                    });
                });
            }
            Err(err) => {
                // If thread pool creation fails, fall back to sequential processing
                timings.insert(
                    "thread_pool_error".to_string(),
                    Value::String(format!("Failed to create thread pool: {:?}", err)),
                );

                process_genes_sequentially(
                    &gene_names,
                    &genes,
                    &gene_to_index,
                    &counts_dataset,
                    &all_gene_data,
                    &samples,
                    &genes_map,
                );
            }
        }
    } else if gene_names.len() == 1 {
        let gene_name = &gene_names[0];

        match genes.iter().position(|x| *x == *gene_name) {
            Some(gene_index) => {
                if gene_index >= counts_dataset.shape()[0] {
                    let mut error_map = Map::new();
                    error_map.insert(
                        "error".to_string(),
                        Value::String("Gene index out of bounds".to_string()),
                    );

                    let mut genes_map = genes_map.lock().unwrap();
                    genes_map.insert(gene_name.clone(), Value::Object(error_map));
                } else {
                    // Read just this single gene's data directly
                    match counts_dataset.read_slice_1d::<f64, _>(s![gene_index, ..]) {
                        Ok(gene_expression) => {
                            // Create samples map for this gene
                            let mut samples_map = Map::new();
                            for (i, sample) in samples.iter().enumerate() {
                                if i < gene_expression.len() {
                                    // Handle potential NaN or infinity values
                                    let value = if gene_expression[i].is_finite() {
                                        Value::from(gene_expression[i])
                                    } else {
                                        Value::Null
                                    };

                                    samples_map.insert(sample.replace("\\", ""), value);
                                }
                            }

                            let gene_data = json!({
                                "dataId": gene_name,
                                "samples": samples_map
                            });

                            let mut genes_map = genes_map.lock().unwrap();
                            genes_map.insert(gene_name.clone(), gene_data);
                        }
                        Err(err) => {
                            let mut error_map = Map::new();
                            error_map.insert(
                                "error".to_string(),
                                Value::String(format!("Failed to read expression values: {:?}", err)),
                            );

                            let mut genes_map = genes_map.lock().unwrap();
                            genes_map.insert(gene_name.clone(), Value::Object(error_map));
                        }
                    }
                }
            }
            None => {
                let mut error_map = Map::new();
                error_map.insert(
                    "error".to_string(),
                    Value::String("Gene not found in dataset".to_string()),
                );

                let mut genes_map = genes_map.lock().unwrap();
                genes_map.insert(gene_name.clone(), Value::Object(error_map));
            }
        }
    }

    // Get the final maps from the Arc<Mutex<>>
    let genes_map = Arc::try_unwrap(genes_map).unwrap().into_inner().unwrap();

    let output_json = json!({
        "genes": genes_map,
        "timings": timings,
        "total_time_ms": overall_start_time.elapsed().as_millis() as u64
    });

    println!("{}", output_json);

    Ok(())
}

// Helper function to process genes sequentially with optional HashMap lookup
fn process_genes_sequentially(
    gene_names: &Vec<String>,
    genes: &Vec<String>,
    gene_to_index: &Option<std::collections::HashMap<String, usize>>,
    counts_dataset: &hdf5::Dataset,
    all_gene_data: &Option<ndarray::ArrayBase<ndarray::OwnedRepr<f64>, ndarray::Dim<[usize; 2]>>>,
    samples: &Vec<String>,
    genes_map: &Arc<std::sync::Mutex<Map<String, Value>>>,
) {
    for gene_name in gene_names {
        // Find the index of the requested gene, using HashMap if available
        let gene_index = match gene_to_index {
            Some(map) => map.get(gene_name).cloned(),
            None => genes.iter().position(|x| *x == *gene_name),
        };

        match gene_index {
            Some(gene_index) => {
                // Make sure the gene index is valid for this dataset
                if gene_index >= counts_dataset.shape()[0] {
                    let mut error_map = Map::new();
                    error_map.insert(
                        "error".to_string(),
                        Value::String("Gene index out of bounds".to_string()),
                    );

                    // Store the error result
                    let mut genes_map = genes_map.lock().unwrap();
                    genes_map.insert(gene_name.clone(), Value::Object(error_map));
                } else {
                    // Use pre-loaded data if available
                    if let Some(ref all_data) = all_gene_data {
                        let gene_expression = all_data.slice(s![gene_index, ..]);

                        // Create samples map for this gene
                        let mut samples_map = Map::new();
                        for (i, sample) in samples.iter().enumerate() {
                            if i < gene_expression.len() {
                                let value = if gene_expression[i].is_finite() {
                                    Value::from(gene_expression[i])
                                } else {
                                    Value::Null
                                };

                                samples_map.insert(sample.replace("\\", ""), value);
                            }
                        }

                        let gene_data = json!({
                            "dataId": gene_name,
                            "samples": samples_map
                        });

                        let mut genes_map = genes_map.lock().unwrap();
                        genes_map.insert(gene_name.clone(), gene_data);
                    } else {
                        // Fallback to per-gene reading if bulk load failed
                        match counts_dataset.read_slice_1d::<f64, _>(s![gene_index, ..]) {
                            Ok(gene_expression) => {
                                // Create samples map for this gene
                                let mut samples_map = Map::new();
                                for (i, sample) in samples.iter().enumerate() {
                                    if i < gene_expression.len() {
                                        let value = if gene_expression[i].is_finite() {
                                            Value::from(gene_expression[i])
                                        } else {
                                            Value::Null
                                        };

                                        samples_map.insert(sample.replace("\\", ""), value);
                                    }
                                }

                                let gene_data = json!({
                                    "dataId": gene_name,
                                    "samples": samples_map
                                });

                                let mut genes_map = genes_map.lock().unwrap();
                                genes_map.insert(gene_name.clone(), gene_data);
                            }
                            Err(err1) => {
                                let mut error_map = Map::new();
                                error_map.insert(
                                    "error".to_string(),
                                    Value::String(format!("Failed to read expression values: {:?}", err1)),
                                );

                                let mut genes_map = genes_map.lock().unwrap();
                                genes_map.insert(gene_name.clone(), Value::Object(error_map));
                            }
                        }
                    }
                }
            }
            None => {
                let mut error_map = Map::new();
                error_map.insert(
                    "error".to_string(),
                    Value::String("Gene not found in dataset".to_string()),
                );

                let mut genes_map = genes_map.lock().unwrap();
                genes_map.insert(gene_name.clone(), Value::Object(error_map));
            }
        }
    }
}
/// Queries expression data for multiple genes from a sparse format HDF5 file
///
/// This function extracts expression values for multiple specified genes from an HDF5 file
/// that uses a sparse matrix representation. It optimizes the query by reading shared datasets only once.
///
/// # Arguments
///
/// * `hdf5_filename` - Path to the HDF5 file
/// * `gene_names` - Vector of gene names to query
///
/// # Returns
///
/// A result indicating success or error. On success, the function prints a JSON object
/// containing expression data for all requested genes to stdout.
fn query_multiple_genes_sparse(hdf5_filename: String, gene_names: Vec<String>) -> Result<()> {
    let overall_start_time = Instant::now();

    // Create timing map
    let mut timings = Map::new();
    timings.insert("gene_count".to_string(), Value::from(gene_names.len()));
    timings.insert("format".to_string(), Value::String("sparse".to_string()));

    // Open file and read datasets
    let file_open_start = Instant::now();
    let file = File::open(&hdf5_filename)?;
    timings.insert(
        "file_open_ms".to_string(),
        Value::from(file_open_start.elapsed().as_millis() as u64),
    );

    let dim_start = Instant::now();
    let ds_dim = file.dataset("data/dim")?;
    let data_dim: Array1<_> = ds_dim.read::<usize, Dim<[usize; 1]>>()?;
    let num_samples = data_dim[0];
    let _num_genes = data_dim[1];
    timings.insert(
        "read_dims_ms".to_string(),
        Value::from(dim_start.elapsed().as_millis() as u64),
    );

    let ds_genes = file.dataset("gene_names")?;
    let genes = ds_genes.read_1d::<FixedAscii<104>>()?;

    let ds_samples = file.dataset("sample_names")?;
    let samples = ds_samples.read_1d::<FixedAscii<104>>()?;

    // Read p dataset (contains pointers for all genes)
    let p_start_time = Instant::now();
    let ds_p = file.dataset("data/p")?;
    let data_p: Array1<usize> = ds_p.read_1d::<usize>()?;
    timings.insert(
        "read_p_dataset_ms".to_string(),
        Value::from(p_start_time.elapsed().as_millis() as u64),
    );

    // Open i and x datasets
    let ds_start_time = Instant::now();
    let ds_i = file.dataset("data/i")?;
    let ds_x = file.dataset("data/x")?;
    timings.insert(
        "open_i_x_datasets_ms".to_string(),
        Value::from(ds_start_time.elapsed().as_millis() as u64),
    );

    // Determine number of threads to use
    let num_threads = num_cpus::get();
    timings.insert("num_threads".to_string(), Value::from(num_threads as u64));

    // Thread-safe maps for results
    let genes_map = Arc::new(std::sync::Mutex::new(Map::new()));
    let gene_timings = Arc::new(std::sync::Mutex::new(Map::new()));

    // Use rayon for parallel processing
    gene_names.par_iter().for_each(|gene_name| {
        let gene_start_time = Instant::now();

        // Find the index of the requested gene
        match genes.iter().position(|&x| x == *gene_name) {
            Some(gene_index) => {
                // Find start and end points for this gene's data
                let array_start_point = data_p[gene_index];
                let array_stop_point = data_p[gene_index + 1];
                let num_populated_cells = array_stop_point - array_start_point;

                if num_populated_cells == 0 {
                    // Gene has no data, create array of zeros
                    let mut samples_map = Map::new();
                    for (_i, sample) in samples.iter().enumerate() {
                        samples_map.insert(sample.to_string().replace("\\", ""), Value::from(0.0));
                    }

                    let gene_data = json!({
                        "dataId": gene_name,
                        "samples": samples_map
                    });

                    let mut genes_map = genes_map.lock().unwrap();
                    genes_map.insert(gene_name.clone(), gene_data);
                } else {
                    // Read data for this gene
                    match ds_i.read_slice_1d::<usize, _>(array_start_point..array_stop_point) {
                        Ok(populated_column_ids) => {
                            match ds_x.read_slice_1d::<f64, _>(array_start_point..array_stop_point) {
                                Ok(populated_column_values) => {
                                    // Generate the complete array from sparse representation
                                    let mut gene_array: Array1<f64> = Array1::zeros(num_samples);

                                    // Fill in values at populated column indices
                                    for (idx, &col_id) in populated_column_ids.iter().enumerate() {
                                        gene_array[col_id] = populated_column_values[idx];
                                    }

                                    // Create samples map
                                    let mut samples_map = Map::new();
                                    for (_i, sample) in samples.iter().enumerate() {
                                        let value = if gene_array[_i].is_finite() {
                                            Value::from(gene_array[_i])
                                        } else {
                                            Value::Null
                                        };

                                        samples_map.insert(sample.to_string().replace("\\", ""), value);
                                    }

                                    let gene_data = json!({
                                        "dataId": gene_name,
                                        "samples": samples_map
                                    });

                                    let mut genes_map = genes_map.lock().unwrap();
                                    genes_map.insert(gene_name.clone(), gene_data);
                                }
                                Err(err) => {
                                    let mut error_map = Map::new();
                                    error_map.insert(
                                        "error".to_string(),
                                        Value::String(format!("Failed to read x dataset: {:?}", err)),
                                    );

                                    let mut genes_map = genes_map.lock().unwrap();
                                    genes_map.insert(gene_name.clone(), Value::Object(error_map));
                                }
                            }
                        }
                        Err(err) => {
                            let mut error_map = Map::new();
                            error_map.insert(
                                "error".to_string(),
                                Value::String(format!("Failed to read i dataset: {:?}", err)),
                            );

                            let mut genes_map = genes_map.lock().unwrap();
                            genes_map.insert(gene_name.clone(), Value::Object(error_map));
                        }
                    }
                }
            }
            None => {
                let mut error_map = Map::new();
                error_map.insert(
                    "error".to_string(),
                    Value::String("Gene not found in dataset".to_string()),
                );

                let mut genes_map = genes_map.lock().unwrap();
                genes_map.insert(gene_name.clone(), Value::Object(error_map));
            }
        }

        // Record timing
        let elapsed_time = gene_start_time.elapsed().as_millis() as u64;
        let mut gene_timings = gene_timings.lock().unwrap();
        gene_timings.insert(gene_name.clone(), Value::from(elapsed_time));
    });

    // Get the final maps from the Arc<Mutex<>>
    let genes_map = Arc::try_unwrap(genes_map).unwrap().into_inner().unwrap();

    let output_json = json!({
        "genes": genes_map,
        "timings": timings,
        "parallel": true,
        "total_time_ms": overall_start_time.elapsed().as_millis() as u64
    });

    println!("{}", output_json);

    Ok(())
}
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

                    // Case 1: Check if "genes" field exists and is an array
                    if json_string["genes"].is_array() {
                        // Convert the JsonValue array to a Vec<String>
                        let mut gene_names: Vec<String> = Vec::new();
                        for gene_value in json_string["genes"].members() {
                            if let Some(gene_str) = gene_value.as_str() {
                                gene_names.push(gene_str.to_string());
                            }
                        }

                        if !gene_names.is_empty() {
                            match detect_hdf5_format(&hdf5_filename)? {
                                "dense" => query_multiple_genes_dense(hdf5_filename, gene_names)?,
                                "sparse" => query_multiple_genes_sparse(hdf5_filename, gene_names)?,
                                _ => {
                                    println!(
                                        "{}",
                                        serde_json::json!({
                                            "status": "failure",
                                            "message": "Cannot query genes in unknown file format.",
                                            "file_path": hdf5_filename
                                        })
                                    );
                                }
                            }
                            return Ok(());
                        }
                    }
                    // Case 2: Check if "gene" field exists and is an array (this handles the case we're seeing)
                    else if json_string["gene"].is_array() {
                        // Convert the JsonValue array to a Vec<String>
                        let mut gene_names: Vec<String> = Vec::new();
                        for gene_value in json_string["gene"].members() {
                            if let Some(gene_str) = gene_value.as_str() {
                                gene_names.push(gene_str.to_string());
                            }
                        }

                        if !gene_names.is_empty() {
                            // Process multiple genes
                            match detect_hdf5_format(&hdf5_filename)? {
                                "dense" => query_multiple_genes_dense(hdf5_filename, gene_names)?,
                                "sparse" => query_multiple_genes_sparse(hdf5_filename, gene_names)?,
                                _ => {
                                    println!(
                                        "{}",
                                        serde_json::json!({
                                            "status": "failure",
                                            "message": "Cannot query genes in unknown file format.",
                                            "file_path": hdf5_filename
                                        })
                                    );
                                }
                            }
                            return Ok(());
                        }
                    }
                    // Case 3: Check if "gene" field exists and is a string (original single gene case)
                    else if let Some(gene_name) = json_string["gene"].as_str() {
                        query_gene(hdf5_filename, gene_name.to_string())?;
                        return Ok(());
                    }
                    println!(
                        "{}",
                        serde_json::json!({
                            "status": "error",
                            "message": "Neither gene nor genes array provided in input"
                        })
                    );
                }
                Err(error) => println!("Incorrect json: {}", error),
            }
        }
        Err(error) => println!("Piping error: {}", error),
    }
    Ok(())
}
