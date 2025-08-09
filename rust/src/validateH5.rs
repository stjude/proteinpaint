// syntax:
// echo '{"hdf5_file":"/path/to/my/local/file.h5", "row_dataset": "samples", "col_dataset": "genesets"}' | ./target/release/validateHDF5

use hdf5::{File, Result};
use serde_json::json;
use std::io;

/// Detects if the HDF5 file contains a valid matrix dataset
pub fn detect_hdf5_format(
    hdf5_filename: &str,
    matrix_name: &str,
    row_dataset: &str,
    col_dataset: &str,
) -> Result<&'static str> {
    let file = File::open(hdf5_filename)?;

    // Check for matrix dataset (must be 2D)
    let matrix_ok = file
        .dataset(matrix_name)
        .map(|dataset| dataset.shape().len() == 2)
        .unwrap_or(false);

    // Check for row dataset (must exist and contain VarLenAscii)
    let row_ok = file
        .dataset(row_dataset)
        .and_then(|ds| ds.read_1d::<hdf5::types::VarLenUnicode>())
        .is_ok();

    // Check for column dataset (must exist and contain VarLenAscii)
    let col_ok = file
        .dataset(col_dataset)
        .and_then(|ds| ds.read_1d::<hdf5::types::VarLenUnicode>())
        .is_ok();

    if matrix_ok && row_ok && col_ok {
        Ok("matrix")
    } else {
        Ok("unknown")
    }
}

/// Validates and loads the HDF5 file
pub fn validate_hdf5_file(hdf5_filename: String, row_dataset: &str, col_dataset: &str) -> Result<()> {
    let file = File::open(&hdf5_filename)?;
    let matrix_name = "matrix";
    let file_format = detect_hdf5_format(&hdf5_filename, matrix_name, row_dataset, col_dataset)?;

    let output = match file_format {
        "matrix" => {
            let dataset = file.dataset(matrix_name)?;
            let matrix_shape = dataset.shape();
            let datatype = dataset.dtype()?;

            // Validate matrix data
            let matrix_valid = if matrix_shape.len() == 2 && matrix_shape[0] > 0 && matrix_shape[1] > 0 {
                // Create a selection for a 1x1 slice at (0,0)
                let selection = hdf5::Selection::from((0..1, 0..1));

                if datatype.is::<f64>() {
                    dataset.read_slice_2d::<f64, _>(selection).is_ok()
                } else if datatype.is::<f32>() {
                    dataset.read_slice_2d::<f32, _>(selection).is_ok()
                } else if datatype.is::<i32>() {
                    dataset.read_slice_2d::<i32, _>(selection).is_ok()
                } else if datatype.is::<i64>() {
                    dataset.read_slice_2d::<i64, _>(selection).is_ok()
                } else {
                    false
                }
            } else {
                false
            };

            json!({
                "status": if matrix_valid { "success" } else { "failure" },
                "message": if matrix_valid {
                    "HDF5 matrix file loaded successfully"
                } else {
                    "Invalid matrix structure"
                },
                "file_path": hdf5_filename,
                "format": "matrix",
                "matrix_dimensions": {
                    "num_rows": matrix_shape.get(0).unwrap_or(&0),
                    "num_columns": matrix_shape.get(1).unwrap_or(&0)
                }
            })
        }
        _ => {
            json!({
                "status": "failure",
                "message": format!(
                    "Missing or invalid required datasets: matrix='{}', row_dataset='{}', col_dataset='{}'",
                    matrix_name, row_dataset, col_dataset
                ),
                "file_path": hdf5_filename,
                "format": "unknown",
                "matrix_dimensions": {
                    "num_rows": 0,
                    "num_columns": 0
                }
            })
        }
    };
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
                Ok(json_value) => {
                    let hdf5_filename = match json_value["hdf5_file"].as_str() {
                        Some(x) => x.to_string(),
                        None => {
                            println!(
                                "{}",
                                json!({
                                    "status": "error",
                                    "message": "HDF5 filename not provided"
                                })
                            );
                            return Ok(());
                        }
                    };
                    let row_dataset = match json_value["row_dataset"].as_str() {
                        Some(x) => x,
                        None => {
                            println!(
                                "{}",
                                json!({
                                    "status": "error",
                                    "message": "row_dataset not provided"
                                })
                            );
                            return Ok(());
                        }
                    };
                    let col_dataset = match json_value["col_dataset"].as_str() {
                        Some(x) => x,
                        None => {
                            println!(
                                "{}",
                                json!({
                                    "status": "error",
                                    "message": "col_dataset not provided"
                                })
                            );
                            return Ok(());
                        }
                    };
                    if let Err(err) = validate_hdf5_file(hdf5_filename.clone(), row_dataset, col_dataset) {
                        println!(
                            "{}",
                            json!({
                                "status": "error",
                                "message": format!("Error validating HDF5 file: {}", err)
                            })
                        )
                    }
                }
                Err(error) => {
                    println!(
                        "{}",
                        json!({
                            "status": "error",
                            "message": format!("Invalid JSON input: {}", error)
                        })
                    );
                }
            }
        }
        Err(error) => {
            println!(
                "{}",
                json!({
                    "status": "error",
                    "message": format!("Error reading input: {}", error)
                })
            );
        }
    }
    Ok(())
}
