// readH5.rs - HDF5 Data Reader
//
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
// echo '{"query":["HALLMARK_ADIPOGENESIS", "HALLMARK_ANGIOGENESIS"],"hdf5_file":"matrix.h5","row_dataset":"samples","col_dataset":"genesets"}' | ./target/release/readHDF5

use hdf5::types::VarLenUnicode;
use hdf5::{File, Result, Selection};
use json::JsonValue;
use rayon::prelude::*;
use serde_json::{Map, Value, json};
use std::io;
use std::sync::Arc;
use std::time::Instant;

/// Trait for converting types to f64, allowing lossy conversions
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

/// Creates an error JSON response
fn error_response(message: impl Into<String>) -> Value {
    json!({
        "status": "error",
        "message": message.into()
    })
}

/// Process matrix data for a given type
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
/// Data query
///
/// Supports f32, f64, i32 and i64 datatypes for the matrix dataset.
/// Uses hardcoded "matrix" dataset and user-specidied row_dataset and col_dataset.
/// row_dataset and col_dataset are read as VarLenUnicode.
/// The value of col_dataset is the key of query value
///
/// # Arguments
/// * `hdf5_filenam` - Path to the HDF5 file
/// * `q` - Query (non-empty array)
/// * `row_dataset_name` - Name of the samples dataset
/// * `col_dataset_name` - Name of gene sets dataset (query)
///
/// # Returns
/// Prints a JSON object with matrix data for query data to stdout
fn query_dataset(
    hdf5_filename: String,
    q: Vec<String>,
    row_dataset_name: String,
    col_dataset_name: String,
) -> Result<()> {
    let overall_start_time = Instant::now();
    let mut timings = Map::new();
    timings.insert("query_count".to_string(), Value::from(q.len()));

    let file = match File::open(&hdf5_filename) {
        Ok(f) => f,
        Err(err) => {
            println!("{}", error_response(format!("Failed to open HDF5 file: {}", err)));
            return Ok(());
        }
    };

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
    let thread_count = std::cmp::min(4, q.len());
    timings.insert("thread_count".to_string(), Value::from(thread_count));

    let results: Vec<(String, Value)> = match rayon::ThreadPoolBuilder::new()
        .num_threads(thread_count)
        .build()
    {
        Ok(pool) => pool.install(|| {
            q
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
            q
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
            let row_dataset = match input_json["row_dataset"].as_str() {
                Some(x) => x.to_string(),
                None => {
                    println!("{}", error_response("row_dataset not provided"));
                    return Ok(());
                }
            };
            let col_dataset = match input_json["col_dataset"].as_str() {
                Some(x) => x.to_string(),
                None => {
                    println!("{}", error_response("col_dataset not provided"));
                    return Ok(());
                }
            };
            let qry: Vec<String> = match &input_json["query"] {
                JsonValue::Array(arr) => arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect(),
                _ => vec![],
            };
            if !qry.is_empty() {
                query_dataset(hdf5_filename, qry, row_dataset, col_dataset)?;
            } else {
                println!("{}", error_response(format!("{} is empty", col_dataset)));
            };
        }
        Err(error) => {
            println!("{}", error_response(format!("Error reading input: {}", error)));
        }
    };
    Ok(())
}
