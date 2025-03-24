// Need to set HDF5_DIR and LD_LIBRARY_PATH in ~/.bash_profile
// Syntax: HDF5_DIR=/usr/local/Homebrew/Cellar/hdf5/1.14.3_1 && echo $HDF5_DIR && cd .. && cargo build --release && json='{"gene":"TP53","hdf5_file":"matrix_with_na_comp_9.h5"}' && time echo $json | target/release/rust_hdf5

use hdf5::types::FixedAscii;
use hdf5::{File, Result};
use json;
use ndarray::{Array1};
use ndarray::Dim;
use std::io;
use std::time::Instant;


// Original function
// fn read_hdf5(hdf5_filename: String, gene_name: String) -> Result<()> {
//     let file = File::open(&hdf5_filename)?; // open for reading
//     let ds_dim = file.dataset("data/dim")?; // open the dataset

//     // Check the data type and read the dataset accordingly
//     let data_dim: Array1<_> = ds_dim.read::<usize, Dim<[usize; 1]>>()?;
//     let num_samples = data_dim[0]; // Number of total columns in the dataset
//     let num_genes = data_dim[1];
//     println!("num_samples:{}", num_samples);
//     println!("num_genes:{}", num_genes);

//     //let now_partial_i = Instant::now();
//     //let data_partial_i: Array1<usize> = ds_i.read_slice_1d(0..20)?;
//     //println!("Data_partial_i: {:?}", data_partial_i);
//     //println!("Time for partial_i dataset:{:?}", now_partial_i.elapsed());
//     //
//     //let now_x = Instant::now();
//     //let ds_x = file.dataset("data/x")?; // open the dataset
//     //let data_x: Array1<_> = ds_x.read::<f64, Dim<[usize; 1]>>()?;
//     //println!("Data_x: {:?}", data_x);
//     //println!("Time for x dataset:{:?}", now_x.elapsed());

//     let now_genes = Instant::now();
//     let ds_genes = file.dataset("gene_names")?;
//     let genes = ds_genes.read_1d::<FixedAscii<104>>()?;
//     //println!("\tgenes = {:?}", genes);
//     //println!("\tgenes.shape() = {:?}", genes.shape());
//     //println!("\tgenes.strides() = {:?}", genes.strides());
//     //println!("\tgenes.ndim() = {:?}", genes.ndim());
//     println!("Time for parsing genes:{:?}", now_genes.elapsed());

//     let now_samples = Instant::now();
//     let ds_samples = file.dataset("sample_names")?;
//     let samples = ds_samples.read_1d::<FixedAscii<104>>()?;
//     //println!("\tsamples = {:?}", samples);
//     //println!("\tsamples.shape() = {:?}", samples.shape());
//     //println!("\tsamples.strides() = {:?}", samples.strides());
//     //println!("\tsamples.ndim() = {:?}", samples.ndim());
//     println!("Time for parsing samples:{:?}", now_samples.elapsed());

//     let gene_index;
//     match genes.iter().position(|&x| x == gene_name) {
//         Some(index) => {
//             println!(
//                 "The index of '{}' is {} in 0-based format (add 1 to compare with R output)",
//                 gene_name, index
//             );
//             gene_index = index;
//         }
//         None => panic!(
//             "Gene '{}' not found in the HDF5 file '{}'",
//             gene_name, &hdf5_filename
//         ),
//     }

//     // Find the number of columns that are populated for that gene
//     let now_p = Instant::now();
//     let ds_p = file.dataset("data/p")?; // open the dataset

//     //let data_p: Array1<_> = ds_p.read::<usize, Dim<[usize; 1]>>()?;
//     let data_partial_p: Array1<usize> = ds_p.read_slice_1d(gene_index..gene_index + 2)?;
//     //println!("Data_p: {:?}", data_p);
//     println!("Data_partial_p: {:?}", data_partial_p);
//     println!("Time for p dataset:{:?}", now_p.elapsed());

//     let array_start_point = data_partial_p[0];
//     let array_stop_point = data_partial_p[1];
//     let num_populated_cells = data_partial_p[1] - array_start_point;
//     println!("Number of populated cells:{}", num_populated_cells);

//     //Find all columns indices that are populated for the given gene
//     let now_i = Instant::now();
//     let ds_i = file.dataset("data/i")?; // open the dataset

//     //let data_i: Array1<_> = ds_i.read::<f64, Dim<[usize; 1]>>()?;
//     //println!("Data_i: {:?}", data_i);
//     let populated_column_ids: Array1<usize> =
//         ds_i.read_slice_1d(array_start_point..array_stop_point - 1)?;
//     println!(
//         "Length of populated_column_ids:{}",
//         populated_column_ids.len()
//     );

//     // Do a sanity check (for testing)
//     //let mut min = 0;
//     //for i in 0..populated_column_ids.len() {
//     //    if populated_column_ids[i] < min {
//     //        println!("Value is decreasing {},{}", populated_column_ids[i], min);
//     //    } else {
//     //        min = populated_column_ids[i];
//     //    }
//     //}
//     println!("Populated cells:{:?}", populated_column_ids);
//     println!("Time for i dataset:{:?}", now_i.elapsed());

//     //Find all columns values that are populated for the given gene
//     let now_x = Instant::now();
//     let ds_x = file.dataset("data/x")?; // open the dataset

//     //let data_x: Array1<_> = ds_x.read::<f64, Dim<[usize; 1]>>()?;
//     //println!("Data_x: {:?}", data_x);
//     let populated_column_values: Array1<f64> =
//         ds_x.read_slice_1d(array_start_point..array_stop_point - 1)?;
//     println!(
//         "Length of populated_column_ids:{}",
//         populated_column_values.len()
//     );
//     println!("Time for x dataset:{:?}", now_x.elapsed());

//     // Generate the complete array from the sparse array

//     let mut gene_array: Array1<f64> = Array1::zeros(num_samples);
//     let time_generating_full_array = Instant::now();
//     //let mut gene_array: Vec<f64> = Vec::with_capacity(num_samples);
//     for index in 0..num_samples {
//         match populated_column_ids.iter().any(|&x| x == index) {
//             true => match populated_column_ids.iter().position(|&x| x == index) {
//                 Some(y) => {
//                     gene_array[index] = populated_column_values[y] //gene_array.push(populated_column_values[y]),
//                 }
//                 None => {} // should not happen because if the index is found, its position in the array should also be found
//             },
//             false => gene_array[index] = 0.0, //gene_array.push(0.0), // If index not found, it means the value is 0 for that sample
//         }
//     }

//     let mut output_string = "{".to_string();
//     for i in 0..gene_array.len() {
//         //let item_json = "{\"".to_string()
//         //    + &samples[i].to_string()
//         //    + &"\","
//         //    + &gene_array[i].to_string()
//         //    + &"}";

//         //let item_json = format!("{{\"{}\"}}", samples[i].to_string());

//         output_string += &format!(
//             "\"{}\":{}",
//             samples[i].to_string(),
//             gene_array[i].to_string()
//         );
//         //println!("item_json:{}", item_json);

//         //let item_json = format!(
//         //    r##"{{"{}",{}}}"##,
//         //    samples[i].to_string().replace("\\", ""),
//         //    gene_array[i].to_string()
//         //);
//         if i != gene_array.len() - 1 {
//             output_string += &",";
//         }
//     }
//     output_string += &"}".to_string();
//     output_string = output_string.replace("\\", "");
//     println!(
//         "Time generating full array:{:?}",
//         time_generating_full_array.elapsed()
//     );
//     println!("output_string:{}", output_string);

//     // Print individual element in array

//     //let arr = v.iter().collect::<Vec<_>>();
//     //for (idx, val) in arr.iter().enumerate() {
//     //    println!("\tarr[{:?}] = {:?} ({:?})", idx, val.to_string(), val.len());
//     //}

//     //for item in data_i {
//     //    println!("i:{}", item);
//     //}
//     Ok(())
// }


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
        //eprintln!("Dense format detected");
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

// Function to query a gene in a dense format HDF5 file
fn query_gene_dense(hdf5_filename: String, gene_name: String) -> Result<()> {
    let file = File::open(&hdf5_filename)?;

    // Read gene names
    // let now_genes = Instant::now();
    let ds_genes = file.dataset("gene_names")?;
    let genes = ds_genes.read_1d::<FixedAscii<104>>()?;
    
    // Find the gene index
    // eprintln!("Gene name: {}", gene_name);
    let gene_index = match genes.iter().position(|&x| x == gene_name) {
        Some(index) => {
            eprintln!(
                "The index of '{}' is {} in 0-based format (add 1 to compare with R output)",
                gene_name, index
            );
            index
        },
        None => {
            println!("output_string:{}", serde_json::json!({
                "status": "failure",
                "message": format!("Gene '{}' not found in the HDF5 file", gene_name),
                "file_path": hdf5_filename,
                "gene": gene_name
            }));
            return Ok(());
        }
    };
    
    // Read sample names
    let now_samples = Instant::now();
    let ds_samples = file.dataset("samples")?;
    let samples = ds_samples.read_1d::<FixedAscii<104>>()?;
    println!("Time for parsing samples:{:?}", now_samples.elapsed());
    
    // Read counts data for the gene
    let now_counts = Instant::now();
    let ds_counts = file.dataset("counts")?;
    // Use ndarray's s! macro to slice the dataset
    let gene_data: Array1<f64> = ds_counts.read_slice(ndarray::s![gene_index, ..])?;
    println!("Time for reading gene data:{:?}", now_counts.elapsed());
    
    // Create result JSON
    let mut output_string = "{".to_string();
    for i in 0..gene_data.len() {
        output_string += &format!(
            "\"{}\":{}",
            samples[i].to_string().replace("\\", ""),
            gene_data[i].to_string()
        );
        
        if i != gene_data.len() - 1 {
            output_string += &",";
        }
    }
    output_string += &"}".to_string();
    
    println!("output_string:{}", output_string);
    
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