// readH5.rs - validate/read HDF5 file
//
// READ:
// Extracts matrix from HDF5 files.
// Matrix dataset is hardcoded as "matrix". row_dataset(samples) and col_dataset(genesets)
// row_dataset and col_dataset are stored as VarLenUnicode.
// Supports f32, f64, i32 and i64 matrix datatypes.
//
// Features:
// - Hardcoded "matrix" dataset
// - Supports f32, f64, i32 and i64 matrix datatypes
// - Parallel processing with dynamic thread count
// - JSON output with timing metrics

// Usage
// echo '{"query":["HALLMARK_ADIPOGENESIS", "HALLMARK_ANGIOGENESIS"],"hdf5_file":"matrix.h5"}' | ./target/release/readH5
//
//
// VLIDATE:
// output: JSON with {"samples":[]}
// Usage
// echo '{"validate":true,"hdf5_file":"matrix.h5"}' | ./target/release/readH5

use hdf5::types::VarLenUnicode;
use hdf5::{File, Result, Selection};
use json::JsonValue;
use rayon::prelude::*;
use serde_json::{Map, Value, json};
use std::io;
use std::sync::Arc;
use std::time::Instant;

/// Creates an error JSON response
fn error_response(message: impl Into<String>) -> Value {
    json!({
        "status": "error",
        "message": message.into()
    })
}

/// h5 file validation
// Detects if the HDF5 file contains a valid matrix dataset
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

pub fn validate_hdf5_file(hdf5_filename: String) -> Result<()> {
    let file = File::open(&hdf5_filename)?;
    let matrix_name = "matrix";
    let row_dataset = "samples";
    let col_dataset = "item";
    let file_format = detect_hdf5_format(&hdf5_filename, matrix_name, row_dataset, col_dataset)?;

    let output = match file_format {
        "matrix" => {
            let dataset = file.dataset(matrix_name)?;
            let matrix_shape = dataset.shape();
            let datatype = dataset.dtype()?;

            // Read row_dataset as VarLenUnicode
            let row_dataset_data = file.dataset(row_dataset)?;
            let row_data: Vec<String> = row_dataset_data
                .read_1d::<VarLenUnicode>()?
                .iter()
                .map(|s| s.to_string())
                .collect();

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
                },
                row_dataset.to_string(): row_data
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

/// read h5 file

// Trait for converting types to f64, allowing lossy conversions
trait ToF64 {
    fn to_f64(&self) -> f64;
}

impl ToF64 for f32 {
    fn to_f64(&self) -> f64 {
        *self as f64
    }
}

impl ToF64 for f64 {
    fn to_f64(&self) -> f64 {
        *self
    }
}

impl ToF64 for i32 {
    fn to_f64(&self) -> f64 {
        *self as f64
    }
}

impl ToF64 for i64 {
    fn to_f64(&self) -> f64 {
        if self.abs() > (1 << 53) {
            eprintln!("Warning: i64 value {} may lose precision when converted to f64", self);
        }
        *self as f64
    }
}

// Process matrix data for a given type
fn process_data<T: ToF64 + Copy>(data: &[T], row_data: &[String]) -> Map<String, Value> {
    let mut row_data_map = Map::new();
    for (i, row) in row_data.iter().enumerate() {
        if i < data.len() {
            let value = data[i].to_f64();
            row_data_map.insert(
                row.replace("\\", ""),
                if value.is_finite() {
                    Value::from(value)
                } else {
                    Value::Null
                },
            );
        }
    }
    row_data_map
}

// Data query
// Supports f32, f64, i32 and i64 datatypes for the matrix dataset.
// Uses hardcoded "matrix", "samples" and "item" dataset.
// "samples" and "item" datasets are read as VarLenUnicode.
//
// # Arguments
// * `hdf5_filenam` - Path to the HDF5 file
// * `qry` - Query (non-empty array)
//
// # Returns
// Prints a JSON object with matrix data for query data to stdout
fn query_dataset(hdf5_filename: String, qry: Vec<String>) -> Result<()> {
    let overall_start_time = Instant::now();
    let mut timings = Map::new();
    timings.insert("query_count".to_string(), Value::from(qry.len()));

    let file = match File::open(&hdf5_filename) {
        Ok(f) => f,
        Err(err) => {
            println!("{}", error_response(format!("Failed to open HDF5 file: {}", err)));
            return Ok(());
        }
    };

    let col_dataset_name = String::from("item");
    let col_dataset = match file.dataset(&col_dataset_name) {
        Ok(ds) => ds,
        Err(err) => {
            println!(
                "{}",
                error_response(format!("Failed to open {} dataset: {}", col_dataset_name, err))
            );
            return Ok(());
        }
    };

    let col_dataset_varlen = match col_dataset.read_1d::<VarLenUnicode>() {
        Ok(g) => g,
        Err(err) => {
            println!(
                "{}",
                error_response(format!("Failed to read {}: {}", col_dataset_name, err))
            );
            return Ok(());
        }
    };
    let col_data: Vec<String> = col_dataset_varlen.iter().map(|g| g.to_string()).collect();

    let hashmap_start_time = Instant::now();
    let col_data_to_index: std::collections::HashMap<String, usize> =
        col_data.iter().enumerate().map(|(i, g)| (g.clone(), i)).collect();
    timings.insert(
        "build_hashmap_ms".to_string(),
        Value::from(hashmap_start_time.elapsed().as_millis() as u64),
    );

    let row_dataset_name = String::from("samples");
    let row_dataset = match file.dataset(&row_dataset_name) {
        Ok(ds) => ds,
        Err(err) => {
            println!(
                "{}",
                error_response(format!("Failed to open {} dataset: {}", row_dataset_name, err))
            );
            return Ok(());
        }
    };
    let row_dataset_varlen = match row_dataset.read_1d::<VarLenUnicode>() {
        Ok(s) => s,
        Err(err) => {
            println!(
                "{}",
                error_response(format!("Failed to read {}: {}", row_dataset_name, err))
            );
            return Ok(());
        }
    };
    let row_data: Vec<String> = row_dataset_varlen.iter().map(|s| s.to_string()).collect();

    let matrix_dataset = match file.dataset("matrix") {
        Ok(ds) => ds,
        Err(err) => {
            println!("{}", error_response(format!("Failed to open matrix dataset: {}", err)));
            return Ok(());
        }
    };

    let datatype = match matrix_dataset.dtype() {
        Ok(dt) => dt,
        Err(err) => {
            println!("{}", error_response(format!("Failed to read matrix datatype: {}", err)));
            return Ok(());
        }
    };

    let col_data_map = Arc::new(std::sync::Mutex::new(Map::new()));
    let thread_count = std::cmp::min(4, qry.len());
    timings.insert("thread_count".to_string(), Value::from(thread_count));

    let results: Vec<(String, Value)> = match rayon::ThreadPoolBuilder::new()
        .num_threads(thread_count)
        .build()
    {
        Ok(pool) => pool.install(|| {
            qry
                .par_iter()
                .map(|query| {
                    let query_start_time = Instant::now();
                    let result = match col_data_to_index.get(query) {
                        Some(&index) => {
                            if index >= matrix_dataset.shape()[0] {
                                let mut error_map = Map::new();
                                error_map.insert(
                                    "error".to_string(),
                                    Value::String("Query index out of bounds".to_string()),
                                );
                                (query.clone(), Value::Object(error_map))
                            } else {
                                let selection = Selection::from((index..index+1, ..));
                                if datatype.is::<f64>() {
                                    match matrix_dataset.read_slice_2d::<f64,_>(selection) {
                                        Ok(data) => (
                                            query.clone(),
                                            json!({
                                                "dataId": query,
                                                row_dataset_name.clone(): process_data(data.as_slice().unwrap(), &row_data)
                                            }),
                                        ),
                                        Err(err) => {
                                            let mut error_map = Map::new();
                                            error_map.insert(
                                                "error".to_string(),
                                                Value::String(format!("Failed to read f64 matrix values: {}", err)),
                                            );
                                            (query.clone(), Value::Object(error_map))
                                        }
                                    }
                                } else if datatype.is::<f32>() {
                                    match matrix_dataset.read_slice_2d::<f32,_>(selection) {
                                        Ok(data) => (
                                            query.clone(),
                                            json!({
                                                "dataId": query,
                                                row_dataset_name.clone(): process_data(data.as_slice().unwrap(), &row_data)
                                            }),
                                        ),
                                        Err(err) => {
                                            let mut error_map = Map::new();
                                            error_map.insert(
                                                "error".to_string(),
                                                Value::String(format!("Failed to read f32 matrix values: {}", err)),
                                            );
                                            (query.clone(), Value::Object(error_map))
                                        }
                                    }
                                } else if datatype.is::<i32>() {
                                    match matrix_dataset.read_slice_2d::<i32,_>(selection) {
                                         Ok(data) => (
                                            query.clone(),
                                            json!({
                                                "dataId": query,
                                                row_dataset_name.clone(): process_data(data.as_slice().unwrap(), &row_data)
                                            }),
                                        ),
                                        Err(err) => {
                                            let mut error_map = Map::new();
                                            error_map.insert(
                                                "error".to_string(),
                                                Value::String(format!("Failed to read i32 matrix values: {}", err)),
                                            );
                                            (query.clone(), Value::Object(error_map))
                                        }
                                    }
                                } else if datatype.is::<i64>() {
                                    match matrix_dataset.read_slice_2d::<i64,_>(selection) {
                                        Ok(data) => (
                                            query.clone(),
                                            json!({
                                                "dataId": query,
                                                row_dataset_name.clone(): process_data(data.as_slice().unwrap(), &row_data)
                                            }),
                                        ),
                                        Err(err) => {
                                            let mut error_map = Map::new();
                                            error_map.insert(
                                                "error".to_string(),
                                                Value::String(format!("Failed to read i64 matrix values: {}", err)),
                                            );
                                            (query.clone(), Value::Object(error_map))
                                        }
                                    }
                                } else {
                                    let mut error_map = Map::new();
                                    error_map.insert(
                                        "error".to_string(),
                                        Value::String("Unsupported matrix datatype (expected f64, f32, i64 or i32)".to_string()),
                                    );
                                    (query.clone(), Value::Object(error_map))
                                }
                            }
                        }
                        None => {
                            let mut error_map = Map::new();
                            error_map.insert(
                                "error".to_string(),
                                Value::String(format!("Query '{}' not found in {} dataset", query, col_dataset_name)),
                            );
                            (query.clone(),Value::Object(error_map))
                        }
                    };
                    let elapsed_time = query_start_time.elapsed().as_millis() as u64;
                    let mut query_timings = col_data_map.lock().unwrap();
                    query_timings.insert(
                        format!("{}_ms", query),
                        Value::from(elapsed_time),
                    );
                    result
                })
                .collect()
        }),
        Err(err) => {
            timings.insert(
                "thread_pool_error".to_string(),
                Value::String(format!("Failed to create thread pool: {}", err)),
            );
            qry
                .iter()
                .map(|query| {
                    let query_start_time = Instant::now();
                    let result = match col_data_to_index.get(query) {
                        Some(&index) => {
                            if index >= matrix_dataset.shape()[0] {
                                let mut error_map = Map::new();
                                error_map.insert(
                                    "error".to_string(),
                                    Value::String("Query index out of bounds".to_string()),
                                );
                                (query.clone(), Value::Object(error_map))
                            } else {
                                let selection = Selection::from((index..index+1, ..));
                                if datatype.is::<f64>() {
                                    match matrix_dataset.read_slice_1d::<f64,_>(selection) {
                                        Ok(data) => (
                                            query.clone(),
                                            json!({
                                                "dataId": query,
                                                row_dataset_name.clone(): process_data(data.as_slice().unwrap(), &row_data)
                                            }),
                                        ),
                                        Err(err) => {
                                            let mut error_map = Map::new();
                                            error_map.insert(
                                                "error".to_string(),
                                                Value::String(format!("Failed to read f64 matrix values: {}", err)),
                                            );
                                            (query.clone(), Value::Object(error_map))
                                        }
                                    }
                                } else if datatype.is::<f32>() {
                                    match matrix_dataset.read_slice_1d::<f32,_>(selection) {
                                        Ok(data) => (
                                            query.clone(),
                                            json!({
                                                "dataId": query,
                                                row_dataset_name.clone(): process_data(data.as_slice().unwrap(), &row_data)
                                            }),
                                        ),
                                        Err(err) => {
                                            let mut error_map = Map::new();
                                            error_map.insert(
                                                "error".to_string(),
                                                Value::String(format!("Failed to read f32 matrix values: {}", err)),
                                            );
                                            (query.clone(), Value::Object(error_map))
                                        }
                                    }
                                } else if datatype.is::<i32>() {
                                    match matrix_dataset.read_slice_1d::<i32,_>(selection) {
                                         Ok(data) => (
                                            query.clone(),
                                            json!({
                                                "dataId": query,
                                                row_dataset_name.clone(): process_data(data.as_slice().unwrap(), &row_data)
                                            }),
                                        ),
                                        Err(err) => {
                                            let mut error_map = Map::new();
                                            error_map.insert(
                                                "error".to_string(),
                                                Value::String(format!("Failed to read i32 matrix values: {}", err)),
                                            );
                                            (query.clone(), Value::Object(error_map))
                                        }
                                    }
                                } else if datatype.is::<i64>() {
                                    match matrix_dataset.read_slice_1d::<i64,_>(selection) {
                                        Ok(data) => (
                                            query.clone(),
                                            json!({
                                                "dataId": query,
                                                row_dataset_name.clone(): process_data(data.as_slice().unwrap(), &row_data)
                                            }),
                                        ),
                                        Err(err) => {
                                            let mut error_map = Map::new();
                                            error_map.insert(
                                                "error".to_string(),
                                                Value::String(format!("Failed to read i64 matrix values: {}", err)),
                                            );
                                            (query.clone(), Value::Object(error_map))
                                        }
                                    }
                                } else {
                                    let mut error_map = Map::new();
                                    error_map.insert(
                                        "error".to_string(),
                                        Value::String("Unsupported matrix datatype (expected f64, f32, i64 or i32)".to_string()),
                                    );
                                    (query.clone(), Value::Object(error_map))
                                }
                            }
                        }
                        None => {
                            let mut error_map = Map::new();
                            error_map.insert(
                                "error".to_string(),
                                Value::String(format!("Query '{}' not found in {} dataset", query, col_dataset_name)),
                            );
                            (query.clone(),Value::Object(error_map))
                        }
                    };
                    let elapsed_time = query_start_time.elapsed().as_millis() as u64;
                    let mut query_timings = col_data_map.lock().unwrap();
                    query_timings.insert(
                        format!("{}_ms", query),
                        Value::from(elapsed_time),
                    );
                    result
                })
                .collect()
        }
    };

    let mut col_data_map = col_data_map.lock().unwrap();
    for (query, query_data) in results {
        col_data_map.insert(query, query_data);
    }

    let output_json = json!({
        "query_output": *col_data_map,
        "timings": timings,
        "total_time_ms": overall_start_time.elapsed().as_millis() as u64
    });
    println!("{}", output_json);
    Ok(())
}

/// Main function to handle both validation and read of h5 file
fn main() -> Result<()> {
    let mut input = String::new();
    match io::stdin().read_line(&mut input) {
        Ok(_bytes_read) => {
            let input_json = match json::parse(&input) {
                Ok(json) => json,
                Err(_err) => {
                    panic!("Invalid JSON input");
                }
            };

            // Extract HDF5 filename
            let hdf5_filename = match input_json["hdf5_file"].as_str() {
                Some(x) => x.to_string(),
                None => {
                    println!("{}", error_response("HDF5 filename not provided"));
                    return Ok(());
                }
            };

            // h5 file validation
            if input_json.has_key("validate") {
                let v: bool = match input_json["validate"].as_bool() {
                    Some(x) => x,
                    None => false,
                };
                if !v {
                    println!("{}", error_response("The value of validate is invalid"));
                    return Ok(());
                }
                let _ = validate_hdf5_file(hdf5_filename);
            } else if input_json.has_key("query") {
                let qry: Vec<String> = match &input_json["query"] {
                    JsonValue::Array(arr) => arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect(),
                    _ => vec![],
                };
                if !qry.is_empty() {
                    query_dataset(hdf5_filename, qry)?;
                } else {
                    println!("{}", error_response(format!("query is empty")));
                };
            } else {
                println!(
                    "{}",
                    error_response("validate or query has to be provided in input JSON.")
                );
            }
        }
        Err(error) => {
            println!("{}", error_response(format!("Error reading input: {}", error)));
        }
    }
    Ok(())
}
