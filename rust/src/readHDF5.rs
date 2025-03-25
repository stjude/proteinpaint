// Need to set HDF5_DIR and LD_LIBRARY_PATH in ~/.bash_profile
// Syntax: HDF5_DIR=/usr/local/Homebrew/Cellar/hdf5/1.14.3_1 && echo $HDF5_DIR && cd .. && cargo build --release && json='{"gene":"TP53","hdf5_file":"matrix_with_na_comp_9.h5"}' && time echo $json | target/release/rust_hdf5

use hdf5::types::{FixedAscii, VarLenAscii};
use hdf5::{File, Result};
use json;
use ndarray::{Array1, s};
use ndarray::Dim;
use std::io;
use std::time::Instant;


// Function to detect the format of the HDF5 file
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

// Function to read a gene from an HDF5 file
fn query_gene(hdf5_filename: String, gene_name: String) -> Result<()> {
    // First, detect the file format
    let file_format = detect_hdf5_format(&hdf5_filename)?;
    
    // eprintln!("File format: {}", file_format);
    // Query gene data based on format
    match file_format {
        "dense" => query_gene_dense(hdf5_filename, gene_name),
        "sparse" => query_gene_sparse(hdf5_filename, gene_name),
        _ => {
            // For unknown format, return an error
            println!("output_string:{}", serde_json::json!({
                "status": "failure",
                "message": "Cannot query gene in unknown file format. Please use .h5 format in either sparse or dense format.",
                "file_path": hdf5_filename,
                "gene": gene_name,
                "format": "unknown"
            }));
            Ok(())
        }
    }
}


fn query_gene_dense(hdf5_filename: String, gene_name: String) -> Result<()> {
    // let start_time = Instant::now();

    // Open the HDF5 file
    let file = match File::open(hdf5_filename) {
        Ok(f) => f,
        Err(err) => {
            println!(
                "output_string:{{\"status\":\"error\",\"message\":\"Failed to open HDF5 file: {}\"}}",
                err
            );
            return Ok(());
        }
    };

    // Read gene ids using VarLenAscii
    let genes_dataset = match file.dataset("gene_ids") {
        Ok(ds) => ds,
        Err(err) => {
            println!(
                "output_string:{{\"status\":\"error\",\"message\":\"Failed to open gene_ids dataset: {}\"}}",
                err
            );
            return Ok(());
        }
    };

    // Read genes as VarLenAscii
    let genes_varlen = match genes_dataset.read_1d::<VarLenAscii>() {
        Ok(g) => g,
        Err(err) => {
            println!(
                "output_string:{{\"status\":\"error\",\"message\":\"Failed to read gene names as VarLenAscii: {}\"}}",
                err
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
                "output_string:{{\"status\":\"error\",\"message\":\"Failed to open samples dataset: {}\"}}",
                err
            );
            return Ok(());
        }
    };

    // Read samples as VarLenAscii
    let samples_varlen = match samples_dataset.read_1d::<VarLenAscii>() {
        Ok(s) => s,
        Err(err) => {
            println!(
                "output_string:{{\"status\":\"error\",\"message\":\"Failed to read samples as VarLenAscii: {}\"}}",
                err
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
                "output_string:{{\"status\":\"error\",\"message\":\"Gene '{}' not found in the dataset\"}}",
                gene_name
            );
            return Ok(());
        }
    };

    // Read the expression data for the gene
    let counts_dataset = match file.dataset("counts") {
        Ok(ds) => ds,
        Err(err) => {
            println!(
                "output_string:{{\"status\":\"error\",\"message\":\"Failed to open counts dataset: {}\"}}",
                err
            );
            return Ok(());
        }
    };

    // Make sure the gene index is valid for this dataset
    if gene_index >= counts_dataset.shape()[0] {
        println!(
            "output_string:{{\"status\":\"error\",\"message\":\"Gene index is out of bounds for the dataset\"}}"
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
                    "output_string:{{\"status\":\"error\",\"message\":\"Expected a 2D dataset for counts\"}}"
                );
                return Ok(());
            }

            // let num_samples = dataset_shape[1];

            // Try reading the entire dataset and then extracting the row
            match counts_dataset.read::<f64, Dim<[usize; 2]>>() {
                Ok(all_data) => {
                    // Extract just the row we need
                    let row = all_data.slice(s![gene_index, ..]).to_owned();
                    gene_expression = row;

                    // Start building a flatter JSON structure
                    // let mut output_string = String::from("{\"status\":\"success\",\"samples\":{");
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

                    // println!("output_string:{}", output_string);
                }
                Err(err2) => {
                    println!(
                        "output_string:{{\"status\":\"error\",\"message\":\"Failed to read expression values: {:?}, {:?}\"}}",
                        err1, err2
                    );
                    return Ok(());
                }
            }
        }
    }

    // Create the output JSON
    let mut output = String::new();


    // Add metadata fields first
    output.push_str(&format!("{{\"gene\":\"{}\",", gene_name)); // Add the gene name
    output.push_str(&format!("\"dataId\":\"{}\",", gene_name)); // Use gene name as dataId

    // Add samples object
    output.push_str("\"samples\":{");

    // Add key-value pairs for samples
    for (i, sample) in samples.iter().enumerate() {
        if i < gene_expression.len() {
            output.push_str(&format!(
                "\"{}\":{}",
                sample.replace("\\", ""),
                gene_expression[i]
            ));

            if i < gene_expression.len() - 1 && i < samples.len() - 1 {
                output.push_str(",");
            }
        }
    }


    // Close data and root objects
    output.push_str("}}");

    // Remove any backslashes from the output
    output = output.replace("\\", "");

    // Output the final result
    println!("output_string:{}", output);

    Ok(())
}


// Function to query a gene in a sparse format HDF5 file (based on original read_hdf5)
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
            println!("output_string:{}", serde_json::json!({
                "status": "failure",
                "message": format!("Gene '{}' not found in the HDF5 file '{}'", gene_name, &hdf5_filename),
                "file_path": hdf5_filename,
                "gene": gene_name
            }));
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

                    // First validate the file
                    // let now = Instant::now();
                    // Then, check if we have a gene to query
                    if let Some(gene_name) = json_string["gene"].as_str() {
                        let gene_query_time = Instant::now();
                        query_gene(hdf5_filename, gene_name.to_string())?;
                        println!("Time for querying gene: {:?}", gene_query_time.elapsed());
                    }
                }  
                Err(error) => println!("Incorrect json: {}", error),
            }  
        }  
        Err(error) => println!("Piping error: {}", error),
    }  
    Ok(())
}