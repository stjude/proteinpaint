// syntax:
// echo '{"hdf5_file":"/path/to/my/local/file.h5"}' | ./target/release/validateHDF5

use hdf5::types::VarLenAscii;
use hdf5::{File, Result};
use ndarray::Array1;
use ndarray::Dim;
use std::io;

/// Detects the format of the HDF5 file
pub fn detect_hdf5_format(hdf5_filename: &str) -> Result<&'static str> {
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
        // eprintln!("Sparse format detected");
        Ok("sparse")
    } else {
        // eprintln!("Unknown format detected");
        Ok("unknown")
    }
}

/// Validates and loads the HDF5 file
pub fn validate_hdf5_file(hdf5_filename: String) -> Result<()> {
    // Open the HDF5 file
    let file = File::open(&hdf5_filename)?;

    // Detect file format
    let file_format = detect_hdf5_format(&hdf5_filename)?;

    // Get basic information about the file depending on format
    let output = match file_format {
        "dense" => {
            // For dense format, get dimensions from the counts dataset
            let ds_counts = file.dataset("counts")?;
            let data_shape = ds_counts.shape();

            // Read sample names using VarLenAscii
            let mut sample_names: Vec<String> = Vec::new();
            if let Ok(ds_samples) = file.dataset("samples") {
                if let Ok(samples) = ds_samples.read_1d::<VarLenAscii>() {
                    for sample in samples.iter() {
                        sample_names.push(sample.to_string());
                    }
                } else {
                    eprintln!("Error reading samples as VarLenAscii");
                }
            }

            // Read gene names using VarLenAscii
            let mut gene_names: Vec<String> = Vec::new();
            if let Ok(ds_genes) = file.dataset("gene_ids") {
                if let Ok(genes) = ds_genes.read_1d::<VarLenAscii>() {
                    for gene in genes.iter() {
                        gene_names.push(gene.to_string());
                    }
                } else {
                    eprintln!("Error reading gene_ids as VarLenAscii");
                }
            } else {
                eprintln!("Could not find 'gene_ids' dataset");
            }

            // Create JSON with both sample names and gene names
            serde_json::json!({
                "status": "success",
                "message": "HDF5 file loaded successfully",
                "file_path": hdf5_filename,
                "format": "dense",
                "sampleNames": sample_names,
                "matrix_dimensions": {
                    "num_genes": data_shape[0],
                    "num_samples": data_shape[1]
                }
            })
        }
        "sparse" => {
            // For sparse format, get dimensions from the data/dim dataset
            let ds_dim = file.dataset("data/dim")?;
            let data_dim: Array1<usize> = ds_dim.read::<usize, Dim<[usize; 1]>>()?;
            let num_samples = data_dim[0];
            let num_genes = data_dim[1];

            // Read sample names using VarLenAscii
            let mut sample_names: Vec<String> = Vec::new();
            if let Ok(ds_samples) = file.dataset("sample_names") {
                if let Ok(samples) = ds_samples.read_1d::<VarLenAscii>() {
                    for sample in samples.iter() {
                        sample_names.push(sample.to_string());
                    }
                } else {
                    eprintln!("Error reading sample_names as VarLenAscii");
                }
            }

            // Read gene names using VarLenAscii
            let mut gene_names: Vec<String> = Vec::new();
            if let Ok(ds_genes) = file.dataset("gene_names") {
                if let Ok(genes) = ds_genes.read_1d::<VarLenAscii>() {
                    for gene in genes.iter() {
                        gene_names.push(gene.to_string());
                    }
                } else {
                    eprintln!("Error reading gene_names as VarLenAscii");
                }
            } else {
                eprintln!("Could not find 'gene_names' dataset, trying alternatives");
            }

            // Create JSON with the same structure as dense format
            serde_json::json!({
                "status": "success",
                "message": "HDF5 file loaded successfully",
                "file_path": hdf5_filename,
                "format": "sparse",
                "sampleNames": sample_names,
                "matrix_dimensions": {
                    "num_genes": num_genes,
                    "num_samples": num_samples
                }
            })
        }
        _ => {
            // For unknown format
            serde_json::json!({
                "status": "failure",
                "message": "Unknown file format cannot be loaded successfully",
                "file_path": hdf5_filename,
                "format": "unknown",
                "sampleNames": [],
                "geneNames": []
            })
        }
    };

    // Print the output
    println!("{}", output);

    Ok(())
}

/// Main function to handle the validation process
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
                            eprintln!("HDF5 filename not provided");
                            println!(
                                "{}",
                                serde_json::json!({
                                    "status": "error",
                                    "message": "HDF5 filename not provided"
                                })
                            );
                            return Ok(());
                        }
                    };

                    // Log the start of validation
                    // let start_time = Instant::now();
                    // eprintln!("Starting validation of file: {}", hdf5_filename);

                    // Run the validation
                    if let Err(err) = validate_hdf5_file(hdf5_filename.clone()) {
                        eprintln!("Error validating HDF5 file: {:?}", err);
                        println!(
                            "{}",
                            serde_json::json!({
                                "status": "error",
                                "message": format!("Error validating HDF5 file: {}", err)
                            })
                        );
                    }

                    // Log completion time
                    // eprintln!("Validation completed in: {:?}", start_time.elapsed());
                }
                Err(error) => {
                    eprintln!("Incorrect JSON: {}", error);
                    println!(
                        "{}",
                        serde_json::json!({
                            "status": "error",
                            "message": format!("Invalid JSON input: {}", error)
                        })
                    );
                }
            }
        }
        Err(error) => {
            eprintln!("Piping error: {}", error);
            println!(
                "{}",
                serde_json::json!({
                    "status": "error",
                    "message": format!("Error reading input: {}", error)
                })
            );
        }
    }
    Ok(())
}
