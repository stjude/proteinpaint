use hdf5::types::VarLenAscii;
use hdf5::{File, Result};
use json;
use ndarray::{Array1, Array2, Dim, s};
use std::io;
use std::time::Instant;

/// Read expression data for a specific gene from a dense HDF5 file
fn read_dense_hdf5(hdf5_filename: &str, gene_name: &str) -> Result<()> {
    let start_time = Instant::now();

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
    let gene_index = match genes.iter().position(|x| x == gene_name) {
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

            let num_samples = dataset_shape[1];

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

                    println!("output_string:{}", output_string);
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

    // Start with the status
    // output.push_str("{\"status\":\"success\",\"samples\":{");
    // output.push_str("{\"samples\":{");


    // Add metadata fields first
    // output.push_str(&format!("\"status\":\"success\","));
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

// Main function
fn main() -> Result<()> {
    let mut input = String::new();
    match io::stdin().read_line(&mut input) {
        // Accepting the piped input from nodejs (or command line for testing)
        Ok(_) => {
            let input_json = match json::parse(&input) {
                Ok(json) => json,
                Err(error) => {
                    println!(
                        "output_string:{{\"status\":\"error\",\"message\":\"Error parsing JSON: {}\"}}",
                        error
                    );
                    return Ok(());
                }
            };

            // Get the HDF5 filename
            let hdf5_filename = match input_json["file_path"].as_str() {
                Some(x) => x,
                None => {
                    println!(
                        "output_string:{{\"status\":\"error\",\"message\":\"Missing or invalid 'file_path' field\"}}"
                    );
                    return Ok(());
                }
            };

            // Get the gene name
            if let Some(gene) = input_json["gene"].as_str() {
                // Go directly to read_dense_hdf5 with the gene name
                read_dense_hdf5(hdf5_filename, gene)?;
            } else {
                println!(
                    "output_string:{{\"status\":\"error\",\"message\":\"No gene specified in input\"}}"
                );
            }
        }
        Err(error) => {
            println!(
                "output_string:{{\"status\":\"error\",\"message\":\"Error reading stdin: {}\"}}",
                error
            );
        }
    }

    Ok(())
}

