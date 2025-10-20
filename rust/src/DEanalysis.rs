// cd .. && cargo build --release && json='{"min_count":10,"min_total_count":15,"case":"SJMB030827,SJMB030838,SJMB032893,SJMB031131,SJMB031227","control":"SJMB030488,SJMB030825,SJMB031110","data_type":"do_DE","storage_type":"text","input_file":"/Users/rpaul1/pp_data/files/hg38/sjmb12/rnaseq/geneCounts.txt"}' && time echo $json | target/release/DEanalysis
// cd .. && cargo build --release && json='{"data_type":"get_samples","input_file":"/Users/rpaul1/pp_data/files/hg38/ALL-pharmacotyping/rnaseq/counts.h5"}' && time echo $json | target/release/DEanalysis
// cd .. && cargo build --release && time cat ~/sjpp/test.txt | target/release/DEanalysis
#![allow(non_snake_case)]
use hdf5::File as HDF5File;
use hdf5::types::VarLenAscii;
use hdf5::types::VarLenUnicode;
use json;
use nalgebra::DMatrix;
use nalgebra::ViewStorage;
use nalgebra::base::Matrix;
use nalgebra::base::VecStorage;
use nalgebra::base::dimension::Const;
use nalgebra::base::dimension::Dyn;
//use ndarray::Array1;
use ndarray::Array2;
use ndarray::Dim;
use serde::{Deserialize, Serialize};
use serde_json;
use statrs::statistics::Data;
use statrs::statistics::Distribution;
use statrs::statistics::Median;
use std::cmp::Ordering;
use std::fs::File;
use std::io::Read;
use std::str::FromStr;
use std::sync::{Arc, Mutex}; // Multithreading library
use std::thread;
//use std::time::Instant;
//use std::cmp::Ordering;
//use std::env;
use std::io;
mod stats_functions; // Importing Wilcoxon function from stats_functions.rs
const PAR_CUTOFF: usize = 100000; // Cutoff for triggering multithreading processing of data

//const PAR_CUTOFF: usize = 1000000000000000;
#[allow(non_upper_case_globals)]
const max_threads: usize = 6; // Max number of threads in case the parallel processing of reads is invoked

fn binary_search(input: &Vec<usize>, y: usize) -> i64 {
    let input_dup = &input[..];
    let mut index: i64 = -1;
    let mut l: usize = 0;
    let mut r: usize = input_dup.len() - 1;
    let mut m: usize;
    while l <= r {
        m = l + ((r - l) / 2);
        if y == input_dup[m] {
            index = m as i64;
            break;
        } else if y > input_dup[m] {
            l = m + 1;
        }
        // If x is smaller, ignore right half
        else {
            if m == 0 as usize {
                break;
            }
            r = m - 1;
        }
    }
    index
}

fn input_data_from_HDF5(
    hdf5_filename: &String,
    case_list: &Vec<&str>,
    control_list: &Vec<&str>,
) -> (
    Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>>,
    Vec<usize>,
    Vec<usize>,
    Vec<String>,
) {
    let file = HDF5File::open(&hdf5_filename).unwrap(); // open for reading

    //let ds_dim = file.dataset("dims").unwrap(); // open the dataset
    let mut input_vector: Vec<f64> = Vec::with_capacity(500 * 65000);
    let mut case_indexes: Vec<usize> = Vec::with_capacity(case_list.len());
    let mut control_indexes: Vec<usize> = Vec::with_capacity(control_list.len());
    // Check the data type and read the dataset accordingly
    //let data_dim: Array1<_> = ds_dim.read::<usize, Dim<[usize; 1]>>().unwrap();
    //let num_samples = data_dim[0]; // Number of total columns in the dataset
    //let num_genes = data_dim[1]; // Number of total rows in the dataset

    //println!("num_samples bulk:{}", num_samples);
    //println!("num_genes bulk:{}", num_genes);

    // Read the item dataset
    let ds_item = file.dataset("item").unwrap();
    let item = ds_item.read_1d::<VarLenUnicode>().unwrap();
    let gene_names: Vec<String> = item.iter().map(|x| x.to_string()).collect();

    // Read the samples dataset
    let ds_samples = file.dataset("samples").unwrap();
    let samples = ds_samples.read_1d::<VarLenUnicode>().unwrap();

    // Read the matrix dataset
    let ds_matrix = file.dataset("matrix").unwrap();

    // Get dimensions from the matrix dataset
    let matrix_shape = ds_matrix.shape();
    let num_genes = matrix_shape[0];

    let mut global_sample_index = 0;
    for sample_name in case_list {
        if let Some(sample_index) = samples.iter().position(|x| x.to_string() == *sample_name.to_string()) {
            let sample_array: Array2<f64> = ds_matrix
                .read_slice_2d((0..num_genes, sample_index..sample_index + 1))
                .unwrap();
            input_vector.append(&mut sample_array.as_slice().unwrap().to_vec());
            case_indexes.push(global_sample_index);
            global_sample_index += 1;
        }
        // Skip sample if not found
    }

    for sample_name in control_list {
        if let Some(sample_index) = samples.iter().position(|x| x.to_string() == *sample_name.to_string()) {
            let sample_array: Array2<f64> = ds_matrix
                .read_slice_2d((0..num_genes, sample_index..sample_index + 1))
                .unwrap();
            input_vector.append(&mut sample_array.as_slice().unwrap().to_vec());
            control_indexes.push(global_sample_index);
            global_sample_index += 1;
        }
        // Ship sample if not found
    }

    let dm = DMatrix::from_row_slice(case_indexes.len() + control_indexes.len(), num_genes, &input_vector);
    (
        dm.transpose(), // Transposing the matrix
        case_indexes,
        control_indexes,
        gene_names,
    )
}

fn input_data_from_text(
    filename: &String,
    case_list: &Vec<&str>,
    control_list: &Vec<&str>,
) -> (
    Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>>,
    Vec<usize>,
    Vec<usize>,
    Vec<String>,
) {
    //let input_time = Instant::now();
    let mut file = File::open(filename).unwrap();
    let mut num_lines: usize = 0;
    let mut input_vector: Vec<f64> = Vec::with_capacity(500 * 65000);
    let mut gene_ids: Vec<String> = Vec::with_capacity(65000);
    let mut gene_names: Vec<String> = Vec::with_capacity(65000);
    let mut num_columns: usize = 0;

    // Check headers for samples
    let mut buffer = String::new();
    file.read_to_string(&mut buffer).unwrap();
    // Check headers for samples
    let lines: Vec<&str> = buffer.split('\n').collect::<Vec<&str>>();
    let total_lines = lines.len();
    let header_binding = lines[0].replace("\r", "");
    let headers: Vec<&str> = header_binding.split('\t').collect::<Vec<&str>>();
    //println!("headers:{:?}", headers);
    let mut case_indexes_original: Vec<usize> = Vec::with_capacity(case_list.len());
    let mut control_indexes_original: Vec<usize> = Vec::with_capacity(control_list.len());
    let gene_name_index = headers.iter().position(|r| r == &"geneID");
    let gene_symbol_index = headers.iter().position(|r| r == &"geneSymbol");
    //let mut case_samples_not_found: Vec<&str> = Vec::with_capacity(case_list.len());
    //let mut control_samples_not_found: Vec<&str> = Vec::with_capacity(control_list.len());

    for item in case_list {
        //println!("item:{}", item);
        let index = headers.iter().position(|r| r == item);
        match index {
            Some(n) => case_indexes_original.push(n),
            None => {
                //panic!("Case sample not found:{}", item);
                //case_samples_not_found.push(item);
            }
        }
    }
    let num_cases = case_list.len();

    for item in control_list {
        //println!("item:{}", item);
        let index = headers.iter().position(|r| r == item);
        match index {
            Some(n) => control_indexes_original.push(n),
            None => {
                //panic!("Control sample not found:{}", item);
                //control_samples_not_found.push(item);
            }
        }
    }
    let num_controls = control_list.len();
    //println!("case_indexes_original:{:?}", case_indexes_original);
    //println!("control_indexes_original:{:?}", control_indexes_original);
    case_indexes_original.sort();
    case_indexes_original.dedup();
    control_indexes_original.sort();
    control_indexes_original.dedup();
    let mut case_indexes: Vec<usize> = Vec::with_capacity(case_list.len());
    let mut control_indexes: Vec<usize> = Vec::with_capacity(control_list.len());
    if lines.len() * (case_indexes_original.len() + control_indexes_original.len()) < PAR_CUTOFF {
        // If number of lines is below this number
        let lines_slice = &lines[..];
        for line_iter in 1..lines_slice.len() - 1 {
            // Subtracting 1 from total length of lines_slice because the last one will be empty
            let line = lines_slice[line_iter].replace("\r", "");
            let mut index = 0;
            for field in line.split('\t').collect::<Vec<&str>>() {
                if index == gene_name_index.unwrap() {
                    gene_ids.push(field.to_string());
                } else if index == gene_symbol_index.unwrap() {
                    gene_names.push(field.to_string());
                } else if binary_search(&case_indexes_original, index) != -1 {
                    let num = FromStr::from_str(field);
                    match num {
                        Ok(n) => {
                            //println!("n:{}", n);
                            input_vector.push(n);
                            if num_lines == 0 {
                                case_indexes.push(num_columns);
                                num_columns += 1;
                            }
                        }
                        Err(_n) => {
                            panic!(
                                "Number {} in line {} and column {} is not a decimal number",
                                field,
                                num_lines + 1,
                                index + 1
                            );
                        }
                    }
                } else if binary_search(&control_indexes_original, index) != -1 {
                    let num = FromStr::from_str(field);
                    match num {
                        Ok(n) => {
                            //println!("n:{}", n);
                            input_vector.push(n);
                            if num_lines == 0 {
                                control_indexes.push(num_columns);
                                num_columns += 1;
                            }
                        }
                        Err(_n) => {
                            panic!(
                                "Number {} in line {} and column {} is not a decimal number",
                                field,
                                num_lines + 1,
                                index + 1
                            );
                        }
                    }
                }
                index += 1;
            }
            num_lines += 1;
        }
    } else {
        // Multithreaded implementation for parsing data in parallel starts from here
        // Generally in rust one variable only own a data at a time, but `Arc` keyword is special and allows for multiple threads to access the same data.
        let case_indexes_original = Arc::new(case_indexes_original);
        let control_indexes_original = Arc::new(control_indexes_original);
        let buffer = Arc::new(buffer);
        let case_indexes_temp = Arc::new(Mutex::new(Vec::<usize>::with_capacity(case_list.len())));
        let control_indexes_temp = Arc::new(Mutex::new(Vec::<usize>::with_capacity(control_list.len())));
        let num_lines_temp = Arc::new(Mutex::<usize>::new(0));
        let num_columns_temp = Arc::new(Mutex::<usize>::new(0));
        let genes_names_temp = Arc::new(Mutex::new(Vec::<String>::new()));
        let genes_symbols_temp = Arc::new(Mutex::new(Vec::<String>::new()));
        let input_vector_temp = Arc::new(Mutex::new(Vec::<f64>::new()));
        let mut handles = vec![]; // Vector to store handle which is used to prevent one thread going ahead of another
        //println!("Number of threads used:{}", max_threads);
        for thread_num in 0..max_threads {
            let case_indexes_original = Arc::clone(&case_indexes_original);
            let control_indexes_original = Arc::clone(&control_indexes_original);
            let case_indexes_temp = Arc::clone(&case_indexes_temp);
            let control_indexes_temp = Arc::clone(&control_indexes_temp);
            let input_vector_temp = Arc::clone(&input_vector_temp);
            let genes_names_temp = Arc::clone(&genes_names_temp);
            let genes_symbols_temp = Arc::clone(&genes_symbols_temp);
            let num_lines_temp = Arc::clone(&num_lines_temp);
            let num_columns_temp = Arc::clone(&num_columns_temp);
            let buffer = Arc::clone(&buffer);
            let handle = thread::spawn(move || {
                let mut case_indexes_thread: Vec<usize> = Vec::with_capacity(num_cases);
                let mut control_indexes_thread: Vec<usize> = Vec::with_capacity(num_controls);
                let mut genes_names_thread: Vec<String> = Vec::with_capacity(65000);
                let mut genes_symbols_thread: Vec<String> = Vec::with_capacity(65000);
                let mut input_vector_thread: Vec<f64> = Vec::with_capacity(65000);
                let mut num_columns_thread: usize = 0;
                let mut num_lines_thread: usize = 0;
                let lines: Vec<&str> = buffer.split('\n').collect();
                //println!("case_indexes_original:{:?}", case_indexes_original);
                //println!("control_indexes:{:?}", control_indexes);
                for line_iter in 1..total_lines - 1 {
                    let remainder: usize = line_iter % max_threads; // Calculate remainder of line number divided by max_threads to decide which thread parses this line
                    if remainder == thread_num {
                        //println!("buffer:{}", buffer);
                        // Thread analyzing a particular line must have the same remainder as the thread_num, this avoids multiple threads from parsing the same line
                        let line = lines[line_iter].replace("\r", "");
                        let mut index = 0;
                        for field in line.split('\t').collect::<Vec<&str>>() {
                            if index == gene_name_index.unwrap() {
                                genes_names_thread.push(field.to_string());
                            } else if index == gene_symbol_index.unwrap() {
                                genes_symbols_thread.push(field.to_string());
                            } else if binary_search(&case_indexes_original, index) != -1 {
                                let num = FromStr::from_str(field);
                                match num {
                                    Ok(n) => {
                                        //println!("n:{}", n);
                                        input_vector_thread.push(n);
                                        if line_iter == 1 {
                                            case_indexes_thread.push(num_columns_thread);
                                            num_columns_thread += 1;
                                        }
                                    }
                                    Err(_n) => {
                                        panic!(
                                            "Number {} in line {} and column {} is not a decimal number",
                                            field,
                                            num_lines_thread + 1,
                                            index + 1
                                        );
                                    }
                                }
                            } else if binary_search(&control_indexes_original, index) != -1 {
                                let num = FromStr::from_str(field);
                                match num {
                                    Ok(n) => {
                                        //println!("n:{}", n);
                                        input_vector_thread.push(n);
                                        if line_iter == 1 {
                                            control_indexes_thread.push(num_columns_thread);
                                            num_columns_thread += 1;
                                        }
                                    }
                                    Err(_n) => {
                                        panic!(
                                            "Number {} in line {} and column {} is not a decimal number",
                                            field,
                                            num_lines_thread + 1,
                                            index + 1
                                        );
                                    }
                                }
                            }
                            index += 1;
                        }
                        num_lines_thread += 1;
                    }
                }
                input_vector_temp.lock().unwrap().append(&mut input_vector_thread);
                case_indexes_temp.lock().unwrap().append(&mut case_indexes_thread);
                control_indexes_temp.lock().unwrap().append(&mut control_indexes_thread);
                genes_names_temp.lock().unwrap().append(&mut genes_names_thread);
                genes_symbols_temp.lock().unwrap().append(&mut genes_symbols_thread);
                *num_lines_temp.lock().unwrap() += num_lines_thread;
                if num_columns_thread > 0 {
                    *num_columns_temp.lock().unwrap() += num_columns_thread;
                }
                drop(input_vector_temp);
                drop(case_indexes_temp);
                drop(control_indexes_temp);
                drop(genes_names_temp);
                drop(genes_symbols_temp);
                drop(num_lines_temp);
                drop(num_columns_temp);
            });
            handles.push(handle); // The handle (which contains the thread) is stored in the handles vector
        }
        for handle in handles {
            // Wait for all threads to finish before proceeding further
            handle.join().unwrap();
        }
        // Combining data from all different threads
        input_vector.append(&mut *input_vector_temp.lock().unwrap());
        case_indexes.append(&mut *case_indexes_temp.lock().unwrap());
        control_indexes.append(&mut *control_indexes_temp.lock().unwrap());
        gene_ids.append(&mut *genes_names_temp.lock().unwrap());
        gene_names.append(&mut *genes_symbols_temp.lock().unwrap());

        num_lines += *num_lines_temp.lock().unwrap();
        num_columns += *num_columns_temp.lock().unwrap();
    }
    //println!("case_indexes:{:?}", case_indexes);
    //println!("control_indexes:{:?}", control_indexes);
    //println!("num_lines:{}", num_lines);
    //println!("num_columns:{}", num_columns);
    //println!("num_lines * num_columns:{}", num_lines * num_columns);
    //println!("input_vector:{:?}", input_vector.len());
    //println!("Time for inputting data:{:?}", input_time.elapsed());
    let dm = DMatrix::from_row_slice(num_lines, num_columns, &input_vector);
    //println!("dm:{:?}", dm);
    (dm, case_indexes, control_indexes, gene_names)
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
struct AdjustedPValueIndexes {
    index: usize,
    gene_name: String,
    fold_change: f64,
    original_p_value: f64,
    adjusted_p_value: f64,
}

struct PValueIndexes {
    index: usize,
    gene_name: String,
    fold_change: f64,
    p_value: f64,
}

// Used to get the sample names from HDF5 file at PP server startup
fn get_DE_samples(hdf5_filename: &String) {
    let file = HDF5File::open(&hdf5_filename).unwrap(); // open for reading

    //let now_samples = Instant::now();
    let ds_samples = file.dataset("samples").unwrap();
    let samples = ds_samples.read::<VarLenAscii, Dim<[usize; 1]>>().unwrap();
    //println!("\tsamples = {:?}", samples);
    //println!("\tsamples.shape() = {:?}", samples.shape());
    //println!("\tsamples.strides() = {:?}", samples.strides());
    //println!("\tsamples.ndim() = {:?}", samples.ndim());
    //println!("Time for parsing samples:{:?}", now_samples.elapsed());

    let mut output_string = "".to_string();
    for i in 0..samples.len() {
        //let item_json = "{\"".to_string()
        //    + &samples[i].to_string()
        //    + &"\","
        //    + &gene_array[i].to_string()
        //    + &"}";

        //let item_json = format!("{{\"{}\"}}", samples[i].to_string());

        output_string += &format!("{}", samples[i].to_string());
        //println!("item_json:{}", item_json);

        //let item_json = format!(
        //    r##"{{"{}",{}}}"##,
        //    samples[i].to_string().replace("\\", ""),
        //    gene_array[i].to_string()
        //);
        if i != samples.len() - 1 {
            output_string += &",";
        }
    }
    println!("{}", output_string);
}

fn main() {
    //env::set_var("RUST_BACKTRACE", "full");
    let mut input = String::new();
    //env::set_var("RUST_BACKTRACE", "1");
    match io::stdin().read_line(&mut input) {
        // Accepting the piped input from nodejs (or command line from testing)
        Ok(_bytes_read) => {
            //println!("{} bytes read", bytes_read);
            //println!("{}", input);
            let input_json = json::parse(&input);
            match input_json {
                Ok(json_string) => {
                    //let now = Instant::now();
                    let file_name = &json_string["input_file"]
                        .to_owned()
                        .as_str()
                        .unwrap()
                        .to_string()
                        .split(",")
                        .collect();
                    //println!("file_name:{}", file_name);
                    let data_type_option = json_string["data_type"].as_str().to_owned();
                    match data_type_option {
                        Some(x) => {
                            if x == "get_samples" {
                                get_DE_samples(file_name)
                            } else if x == "do_DE" {
                                let min_count_option = json_string["min_count"].as_f64().to_owned();
                                let min_total_count_option = json_string["min_total_count"].as_f64().to_owned();
                                let storage_type_option = json_string["storage_type"].as_str().to_owned();
                                let storage_type;
                                match storage_type_option {
                                    Some(x) => {
                                        if x == "HDF5" {
                                            storage_type = "HDF5"
                                        } else if x == "text" {
                                            storage_type = "text"
                                        } else {
                                            panic!("Unknown storage_type:{}{}", x, " Needs to be either HDF5 or text");
                                        }
                                    }
                                    None => panic!("storage_type needs to be HDF5 or text"),
                                }
                                let min_count;
                                match min_count_option {
                                    Some(x) => min_count = x,
                                    None => {
                                        panic!("min_count is missing a value")
                                    }
                                }
                                let min_total_count;
                                match min_total_count_option {
                                    Some(x) => min_total_count = x,
                                    None => {
                                        panic!("min_total_count is missing a value")
                                    }
                                }
                                let case_string = &json_string["case"].to_owned().as_str().unwrap().to_string();
                                let control_string = &json_string["control"].to_owned().as_str().unwrap().to_string();
                                let case_list: Vec<&str> = case_string.split(",").collect();
                                let control_list: Vec<&str> = control_string.split(",").collect();
                                let (input_matrix, case_indexes, control_indexes, gene_names);
                                if storage_type == "text" {
                                    (input_matrix, case_indexes, control_indexes, gene_names) =
                                        input_data_from_text(file_name, &case_list, &control_list);
                                } else {
                                    // Parsing data from a HDF5 file
                                    (input_matrix, case_indexes, control_indexes, gene_names) =
                                        input_data_from_HDF5(file_name, &case_list, &control_list);
                                }
                                //let filtering_time = Instant::now();
                                let (filtered_matrix, lib_sizes, filtered_gene_names) = filter_by_expr(
                                    min_count,
                                    min_total_count,
                                    &input_matrix,
                                    case_indexes.len(),
                                    control_indexes.len(),
                                    gene_names,
                                );
                                //println!("filtering time:{:?}", filtering_time.elapsed());
                                //println!("filtered_matrix_rows:{:?}", filtered_matrix.nrows());
                                //println!("filtered_matrix_cols:{:?}", filtered_matrix.ncols());
                                if filtered_matrix.nrows() == 0 {
                                    // Its possible after filtering there might not be any genes left in the matrix, in such a case the rust code must exit gracefully with an error.
                                    panic!("Number of genes after filtering = 0, cannot proceed any further")
                                }
                                if filtered_matrix.ncols() == 0 {
                                    // Its possible after filtering there might not be any samples left in the matrix, in such a case the rust code must exit gracefully with an error.
                                    panic!("Number of samples after filtering = 0, cannot proceed any further")
                                }
                                //let cpm_normalization_time = Instant::now();
                                let mut normalized_matrix = cpm(&filtered_matrix);
                                //println!(
                                //    "cpm normalization time:{:?}",
                                //    cpm_normalization_time.elapsed()
                                //);
                                //let tmm_normalization_time = Instant::now();
                                let norm_factors = tmm_normalization(filtered_matrix, &lib_sizes);
                                //println!(
                                //    "tmm normalization time:{:?}",
                                //    tmm_normalization_time.elapsed()
                                //);
                                //println!("norm_factors:{:?}", norm_factors);

                                for col in 0..normalized_matrix.ncols() {
                                    let norm_factor = norm_factors[col];
                                    for row in 0..normalized_matrix.nrows() {
                                        normalized_matrix[(row, col)] = normalized_matrix[(row, col)] / norm_factor;
                                    }
                                }
                                //println!("normalized_matrix:{:?}", normalized_matrix);
                                //println!("Number of cases:{}", case_list.len());
                                //println!("Number of controls:{}", control_list.len());
                                //println!("Time for pre-processing:{:?}", now.elapsed());
                                // Using Wilcoxon test for differential gene expression

                                //let now2 = Instant::now();
                                let mut p_values: Vec<PValueIndexes> = Vec::with_capacity(normalized_matrix.nrows());
                                const THRESHOLD: usize = 50; // This determines whether the Wilcoxon exact test or the normal test will be used based on sample size.

                                //println!("case_indexes:{:?}", case_indexes);
                                //println!("control_indexes:{:?}", control_indexes);
                                //let num_normalized_rows = normalized_matrix.nrows();
                                if normalized_matrix.nrows() * normalized_matrix.ncols() < PAR_CUTOFF {
                                    for i in 0..normalized_matrix.nrows() {
                                        let row = normalized_matrix.row(i);
                                        //println!("row:{:?}", row);
                                        let mut treated = Vec::<f64>::new();
                                        let mut control = Vec::<f64>::new();
                                        //println!("conditions:{:?}", conditions);
                                        for j in 0..(case_indexes.len() + control_indexes.len()) {
                                            //println!("row[(0, j)]:{}", row[(0, j)]);
                                            if case_indexes.contains(&j) {
                                                treated.push(row[(0, j)]);
                                                //println!("{},{}", input_data_vec.0[i][j], "Diseased");
                                            } else if control_indexes.contains(&j) {
                                                // + 1 was added because in the input file the first column of thw first row is blank as the first column consists of gene names
                                                control.push(row[(0, j)]);
                                                //println!("{},{}", input_data_vec.0[i][j], "Control");
                                            } else {
                                                panic!("Column {} could not be classified into case/control", j);
                                            }
                                        }
                                        //println!("treated{:?}", treated);
                                        //println!("control{:?}", control);
                                        let p_value = stats_functions::wilcoxon_rank_sum_test(
                                            treated.clone(),
                                            control.clone(),
                                            THRESHOLD,
                                            't',
                                            true,
                                        ); // Setting continuity correction to true in case of normal approximation
                                        let treated_mean = Data::new(treated).mean();
                                        let control_mean = Data::new(control).mean();
                                        if (treated_mean.unwrap() / control_mean.unwrap()).log2().is_nan() == false
                                            && (treated_mean.unwrap() / control_mean.unwrap()).log2().is_infinite()
                                                == false
                                        {
                                            p_values.push(PValueIndexes {
                                                index: i,
                                                gene_name: filtered_gene_names[i].to_owned(),
                                                fold_change: (treated_mean.unwrap() / control_mean.unwrap()).log2(),
                                                p_value: p_value,
                                            });
                                        }
                                    }
                                } else {
                                    // Multithreaded implementation of calculating wilcoxon p-values
                                    let normalized_matrix_temp = Arc::new(normalized_matrix);
                                    let filtered_gene_names_temp = Arc::new(filtered_gene_names);
                                    let case_indexes_temp = Arc::new(case_indexes);
                                    let control_indexes_temp = Arc::new(control_indexes);
                                    let p_values_temp = Arc::new(Mutex::new(Vec::<PValueIndexes>::new()));
                                    let mut handles = vec![]; // Vector to store handle which is used to prevent one thread going ahead of another
                                    for thread_num in 0..max_threads {
                                        let normalized_matrix_temp = Arc::clone(&normalized_matrix_temp);
                                        let case_indexes_temp = Arc::clone(&case_indexes_temp);
                                        let control_indexes_temp = Arc::clone(&control_indexes_temp);
                                        let p_values_temp = Arc::clone(&p_values_temp);
                                        let filtered_gene_names_temp = Arc::clone(&filtered_gene_names_temp);
                                        let handle = thread::spawn(move || {
                                            let mut p_values_thread: Vec<PValueIndexes> =
                                                Vec::with_capacity(normalized_matrix_temp.nrows() / max_threads);
                                            for i in 0..normalized_matrix_temp.nrows() {
                                                let remainder: usize = i % max_threads; // Calculate remainder of iteration number divided by max_threads to decide which thread parses the row
                                                if remainder == thread_num {
                                                    let row = normalized_matrix_temp.row(i);
                                                    //println!("row:{:?}", row);
                                                    let mut treated = Vec::<f64>::new();
                                                    let mut control = Vec::<f64>::new();
                                                    //println!("conditions:{:?}", conditions);
                                                    for j in 0..(case_indexes_temp.len() + control_indexes_temp.len()) {
                                                        //println!("row[(0, j)]:{}", row[(0, j)]);
                                                        if case_indexes_temp.contains(&j) {
                                                            treated.push(row[(0, j)]);
                                                            //println!("{},{}", input_data_vec.0[i][j], "Diseased");
                                                        } else if control_indexes_temp.contains(&j) {
                                                            // + 1 was added because in the input file the first column of thw first row is blank as the first column consists of gene names
                                                            control.push(row[(0, j)]);
                                                            //println!("{},{}", input_data_vec.0[i][j], "Control");
                                                        } else {
                                                            panic!(
                                                                "Column {} could not be classified into case/control",
                                                                j
                                                            );
                                                        }
                                                    }
                                                    //println!("treated{:?}", treated);
                                                    //println!("control{:?}", control);
                                                    let p_value = stats_functions::wilcoxon_rank_sum_test(
                                                        treated.clone(),
                                                        control.clone(),
                                                        THRESHOLD,
                                                        't',
                                                        true,
                                                    ); // Setting continuity correction to true in case of normal approximation
                                                    let treated_mean = Data::new(treated).mean();
                                                    let control_mean = Data::new(control).mean();
                                                    if (treated_mean.unwrap() / control_mean.unwrap()).log2().is_nan()
                                                        == false
                                                        && (treated_mean.unwrap() / control_mean.unwrap())
                                                            .log2()
                                                            .is_infinite()
                                                            == false
                                                    {
                                                        p_values_thread.push(PValueIndexes {
                                                            index: i,
                                                            gene_name: filtered_gene_names_temp[i].to_owned(),
                                                            fold_change: (treated_mean.unwrap()
                                                                / control_mean.unwrap())
                                                            .log2(),
                                                            p_value: p_value,
                                                        });
                                                    }
                                                }
                                            }
                                            p_values_temp.lock().unwrap().append(&mut p_values_thread);
                                        });
                                        handles.push(handle);
                                    }
                                    for handle in handles {
                                        // Wait for all threads to finish before proceeding further
                                        handle.join().unwrap();
                                    }
                                    p_values.append(&mut *p_values_temp.lock().unwrap());
                                }
                                //println!("p_values:{:?}", p_values);
                                //println!(
                                //    "Time for running {} wilcoxon tests:{:?}",
                                //    num_normalized_rows,
                                //    now2.elapsed()
                                //);
                                let adjusted_p_values = adjust_p_values(p_values);
                                println!("{}", adjusted_p_values);
                                //let fold_changes =
                                //    calculate_fold_change(normalized_matrix, case_indexes, control_indexes);
                            }
                        }
                        None => {
                            panic!("data_type is missing")
                        }
                    }
                }
                Err(error) => panic!("Incorrect json: {}", error),
            }
        }
        Err(error) => panic!("Piping error: {}", error),
    }
}

fn adjust_p_values(mut original_p_values: Vec<PValueIndexes>) -> String {
    // Sorting p-values in ascending order
    original_p_values
        .as_mut_slice()
        .sort_by(|a, b| (a.p_value).partial_cmp(&b.p_value).unwrap_or(Ordering::Equal));

    let mut adjusted_p_values: Vec<AdjustedPValueIndexes> = Vec::with_capacity(original_p_values.len());
    let mut old_p_value: f64 = 0.0;
    let mut rank: f64 = original_p_values.len() as f64;
    for j in 0..original_p_values.len() {
        let i = original_p_values.len() - j - 1;

        //println!("p_val:{}", p_val);
        let mut adjusted_p_val: f64 = original_p_values[i].p_value * (original_p_values.len() as f64 / rank); // adjusted p-value = original_p_value * (N/rank)
        if adjusted_p_val > 1.0 {
            // p_value should NEVER be greater than 1
            adjusted_p_val = 1.0;
        }
        //println!("Original p_value:{}", original_p_values[i].p_value);
        //println!("Raw adjusted p_value:{}", adjusted_p_value);
        if i != original_p_values.len() - 1 {
            if adjusted_p_val > old_p_value {
                adjusted_p_val = old_p_value;
            }
        }
        old_p_value = adjusted_p_val;
        //println!("adjusted_p_value:{}", adjusted_p_val);
        rank -= 1.0;

        adjusted_p_values.push(AdjustedPValueIndexes {
            index: original_p_values[i].index,
            fold_change: original_p_values[i].fold_change,
            gene_name: original_p_values[i].gene_name.to_owned(),
            original_p_value: original_p_values[i].p_value,
            adjusted_p_value: adjusted_p_val,
        });
    }
    adjusted_p_values.sort_by(|a, b| a.index.cmp(&b.index));

    let mut output_string = "[".to_string();
    for i in 0..adjusted_p_values.len() {
        output_string += &serde_json::to_string(&adjusted_p_values[i]).unwrap();
        if i != adjusted_p_values.len() - 1 {
            output_string += &",".to_string();
        }
    }
    output_string += &"]".to_string();
    output_string
}

#[allow(dead_code)]
fn adjust_p_values_bonferroni(original_p_values: Vec<PValueIndexes>) -> Vec<AdjustedPValueIndexes> {
    let mut adjusted_p_values: Vec<AdjustedPValueIndexes> = Vec::with_capacity(original_p_values.len());
    for i in 0..original_p_values.len() {
        let mut adjusted_p_value: f64 = original_p_values[i].p_value * original_p_values.len() as f64; // In bonferroni correction, multiplying p_value by number of tests (excluding those with low sample sizes)
        if adjusted_p_value > 1.0 {
            // p_value should NEVER be greater than 1
            adjusted_p_value = 1.0;
        }
        adjusted_p_values.push(AdjustedPValueIndexes {
            index: original_p_values[i].index,
            gene_name: original_p_values[i].gene_name.to_owned(),
            fold_change: original_p_values[i].fold_change,
            original_p_value: original_p_values[i].p_value,
            adjusted_p_value: adjusted_p_value,
        });
    }
    adjusted_p_values
}

// Original TMM normalization source code in edgeR: https://rdrr.io/bioc/edgeR/src/R/calcNormFactors.R
fn tmm_normalization(input_matrix: Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>>, lib_sizes: &Vec<f64>) -> Vec<f64> {
    //println!("Unnormalized matrix:{:?}", input_matrix);
    let f75 = calc_factor_quantile(&input_matrix, lib_sizes);
    //println!("f75:{:?}", f75);
    let mut ref_column = 0;
    if Data::new(f75.clone()).median() < 1e-20 {
        let mut max = 0.0;
        for col in 0..input_matrix.ncols() {
            let mut col_sum = 0.0;
            for row in 0..input_matrix.nrows() {
                col_sum += (input_matrix[(row, col)] as f64).sqrt();
            }
            if col_sum > max {
                max = col_sum;
                ref_column = col;
            }
        }
    } else {
        let mut min = f64::INFINITY;
        let f75_mean = Data::new(f75.clone()).mean();
        for i in 0..f75.len() {
            let num = (f75[i] - f75_mean.unwrap()).abs();
            if num < min {
                min = num;
                ref_column = i;
            }
        }
    }
    //println!("ref_column:{}", ref_column);
    let num_cols = input_matrix.ncols();
    let mut f: Vec<f64> = Vec::with_capacity(input_matrix.ncols());
    if input_matrix.nrows() * input_matrix.ncols() < PAR_CUTOFF {
        let ref_data = input_matrix.column(ref_column);
        let ref_lib_size = lib_sizes[ref_column];
        for col in 0..input_matrix.ncols() {
            let obs_data = input_matrix.column(col);
            let obs_lib_size = lib_sizes[col];
            f.push(calc_factor_tmm(obs_data, &ref_data, ref_lib_size, obs_lib_size));
        }
    } else {
        // Multithreaded implementation of TMM normalization
        let f_temp = Arc::new(Mutex::new(Vec::<f_index>::new()));
        let lib_sizes_temp = Arc::new(lib_sizes.to_owned());
        let input_matrix_temp = Arc::new(input_matrix);
        let mut handles = vec![]; // Vector to store handle which is used to prevent one thread going ahead of another
        for thread_num in 0..max_threads {
            let f_temp = Arc::clone(&f_temp);
            let lib_sizes_temp = Arc::clone(&lib_sizes_temp);
            let input_matrix_temp = Arc::clone(&input_matrix_temp);
            let handle = thread::spawn(move || {
                let mut f_thread: Vec<f_index> = Vec::with_capacity(input_matrix_temp.ncols() / max_threads);
                let ref_data = input_matrix_temp.column(ref_column);
                let ref_lib_size = lib_sizes_temp[ref_column];
                for col in 0..input_matrix_temp.ncols() {
                    let remainder: usize = col % max_threads; // Calculate remainder of column number divided by max_threads to decide which thread parses this column
                    if remainder == thread_num {
                        let obs_data = input_matrix_temp.column(col);
                        let obs_lib_size = lib_sizes_temp[col];
                        f_thread.push(f_index {
                            f: calc_factor_tmm(obs_data, &ref_data, ref_lib_size, obs_lib_size),
                            ind: col,
                        })
                    }
                }
                f_temp.lock().unwrap().append(&mut f_thread);
            });
            handles.push(handle);
        }
        for handle in handles {
            // Wait for all threads to finish before proceeding further
            handle.join().unwrap();
        }
        let mut f_orig: Vec<f_index> = Vec::with_capacity(num_cols);
        f_orig.append(&mut *f_temp.lock().unwrap());
        // Need to sort vector because the vector will not be ordered accord to ind because of multithreading
        f_orig
            .as_mut_slice()
            .sort_by(|a, b| (a.ind).partial_cmp(&b.ind).unwrap_or(Ordering::Equal));
        f = f_orig.into_iter().map(|x| x.f).collect::<Vec<f64>>();
    }
    const NATURAL_E: f64 = 2.718281828459;
    let log_f: Vec<f64> = f.clone().into_iter().map(|x| x.log(NATURAL_E)).collect();
    let exp_mean_log_f = Data::new(log_f).mean().unwrap().exp();
    let final_f: Vec<f64> = f.into_iter().map(|x| x / exp_mean_log_f).collect();
    final_f
}
#[allow(non_camel_case_types)]
struct f_index {
    f: f64,
    ind: usize,
}

fn calc_factor_tmm(
    obs_data: Matrix<f64, Dyn, Const<1>, ViewStorage<'_, f64, Dyn, Const<1>, Const<1>, Dyn>>,
    ref_data: &Matrix<f64, Dyn, Const<1>, ViewStorage<'_, f64, Dyn, Const<1>, Const<1>, Dyn>>,
    n_r: f64,
    n_o: f64,
) -> f64 {
    let mut log_r: Vec<f64> = Vec::with_capacity(obs_data.nrows());
    let mut abs_e: Vec<f64> = Vec::with_capacity(obs_data.nrows());
    let mut v: Vec<f64> = Vec::with_capacity(obs_data.nrows());
    const A_CUTOFF: f64 = -1e10; // Value of constant from R implementation

    let mut max_log_r: f64 = 0.0;
    for i in 0..obs_data.nrows() {
        let obs_f = obs_data[(i, 0)] as f64;
        let ref_f = ref_data[(i, 0)] as f64;
        let obs_n_o = obs_f / n_o;
        let ref_n_r = ref_f / n_r;
        let logr = (obs_n_o / ref_n_r).log2();
        let abse = (obs_n_o.log2() + ref_n_r.log2()) / 2.0;
        if logr != f64::INFINITY && abse != f64::INFINITY && abse > A_CUTOFF {
            log_r.push(logr);
            if logr.abs() > max_log_r {
                max_log_r = logr.abs();
            }
            abs_e.push(abse);
            v.push(((n_o - obs_f) / n_o) / obs_f + ((n_r - ref_f) / n_r) / ref_f);
        }
    }
    //println!("log_r:{:?}", log_r);
    //println!("abs_e:{:?}", abs_e);
    //println!("v:{:?}", v);

    if max_log_r < 1e-6 {
        // Value of constant from R implementation
        1.0
    } else {
        const LOG_RATIO_TRIM: f64 = 0.3; // Value of constant from R implementation
        const SUM_TRIM: f64 = 0.05; // Value of constant from R implementation
        let n = log_r.len() as f64;
        let lo_l = (n * LOG_RATIO_TRIM).floor() + 1.0;
        let hi_l = n + 1.0 - lo_l;
        let lo_s = (n * SUM_TRIM).floor() + 1.0;
        let hi_s = n + 1.0 - lo_s;

        let log_r_log = rank_vector(&log_r);
        let abs_e_log = rank_vector(&abs_e);
        let mut num: f64 = 0.0;
        let mut den: f64 = 0.0;
        for i in 0..log_r.len() {
            if log_r_log[i] >= lo_l && log_r_log[i] <= hi_l && abs_e_log[i] >= lo_s && abs_e_log[i] <= hi_s {
                num += log_r[i] / v[i];
                den += 1.0 / v[i];
            }
        }
        f64::powf(2.0, num / den)
    }
}

#[derive(PartialEq, PartialOrd)]
struct RankInput {
    val: f64,
    orig_index: usize,
}

struct RankOutput {
    orig_index: usize,
    rank: f64,
}

fn rank_vector(input_vector: &Vec<f64>) -> Vec<f64> {
    let mut input_vector_sorted: Vec<RankInput> = Vec::with_capacity(input_vector.len());
    for i in 0..input_vector.len() {
        input_vector_sorted.push(RankInput {
            val: input_vector[i],
            orig_index: i,
        })
    }
    input_vector_sorted.sort_by(|a, b| a.val.partial_cmp(&b.val).unwrap());

    let mut ranks: Vec<RankOutput> = Vec::with_capacity(input_vector_sorted.len()); // Stores the rank of each element
    let mut is_repeat = false;
    let mut frac_rank: f64 = 0.0;
    let mut num_repeats: f64 = 1.0;
    let mut repeat_iter: f64 = 1.0;
    for i in 0..input_vector_sorted.len() {
        // Computing ranks
        if is_repeat == false {
            // Check if current element has other occurences
            num_repeats = 1.0;
            for j in i + 1..input_vector_sorted.len() {
                if input_vector_sorted[i].val == input_vector_sorted[j].val {
                    is_repeat = true;
                    repeat_iter = 1.0;
                    num_repeats += 1.0;
                } else {
                    break;
                }
            }
            //println!("num_repeats:{}", num_repeats);
            if is_repeat == false {
                ranks.push(RankOutput {
                    orig_index: input_vector_sorted[i].orig_index,
                    rank: i as f64 + 1.0,
                });
            } else {
                frac_rank = stats_functions::calculate_frac_rank(i as f64 + 1.0, num_repeats);
                ranks.push(RankOutput {
                    orig_index: input_vector_sorted[i].orig_index,
                    rank: frac_rank,
                });
            }
        } else if repeat_iter < num_repeats {
            // Repeat case
            ranks.push(RankOutput {
                orig_index: input_vector_sorted[i].orig_index,
                rank: frac_rank,
            });
            repeat_iter += 1.0;
            if repeat_iter == num_repeats {
                is_repeat = false;
            }
        } else {
            //println!("i:{}", i);
            ranks.push(RankOutput {
                orig_index: input_vector_sorted[i].orig_index,
                rank: i as f64 + 1.0,
            });
            repeat_iter = 1.0;
            num_repeats = 1.0;
        }
    }
    ranks.sort_by(|a, b| a.orig_index.cmp(&b.orig_index));
    let output_vec: Vec<f64> = ranks.into_iter().map(|x| x.rank).collect();
    output_vec
}

fn calc_factor_quantile(
    input_matrix: &Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>>,
    lib_sizes: &Vec<f64>,
) -> Vec<f64> {
    let mut f = Vec::with_capacity(input_matrix.ncols());
    const P: f64 = 0.75; // Value of constant from R implementation
    for j in 0..input_matrix.ncols() {
        let mut row_vec = Vec::with_capacity(input_matrix.nrows());
        for i in 0..input_matrix.nrows() {
            row_vec.push(input_matrix[(i, j)] as f64);
        }
        let quan = calc_quantile(row_vec, P);
        //println!("quan:{}", quan);
        let num = quan / lib_sizes[j];
        f.push(num);
        //if num == 0.0 {
        //    println!("One or more quantiles are zero");
        //}
    }
    //println!("quantiles:{:?}", f);
    f
}

fn calc_quantile(mut input: Vec<f64>, p: f64) -> f64 {
    let index: f64 = 1.0 + ((input.len() - 1) as f64) * p;
    let lo: f64 = index.floor();
    let hi: f64 = index.ceil();
    input.sort_by(|a, b| a.partial_cmp(&b).unwrap()); // In R implementation "partial sort" was carried out which is upposed to be faster. This might be very slow for very large number of genes. Need to test this out with large number of genes later
    let qs = input[lo as usize - 1];
    let h: f64 = index - lo;
    let qs_final = (1.0 - h) * qs + h * input[hi as usize - 1];
    qs_final
}

// Original filterByExpr source code in edgeR: https://rdrr.io/bioc/edgeR/src/R/filterByExpr.R
fn filter_by_expr(
    min_count: f64,
    min_total_count: f64,
    raw_data: &Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>>,
    num_diseased: usize,
    num_control: usize,
    gene_names: Vec<String>,
) -> (Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>>, Vec<f64>, Vec<String>) {
    // Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>>
    //const min_count: f64 = 10.0; // Value of constant from R implementation
    //const min_total_count: f64 = 15.0; // Value of constant from R implementation
    const LARGE_N: f64 = 10.0; // Value of constant from R implementation
    const MIN_PROP: f64 = 0.7; // Value of constant from R implementation

    let mut min_sample_size;
    if num_control < num_diseased {
        min_sample_size = num_control as f64
    } else {
        min_sample_size = num_diseased as f64
    }
    if min_sample_size == 0.0 {
        panic!("Only one condition present in groups");
    }

    if min_sample_size > LARGE_N {
        min_sample_size = LARGE_N + (min_sample_size - LARGE_N) * MIN_PROP;
    }

    let mut lib_sizes = Vec::<f64>::new();
    let lib_sizes_vector = raw_data.row_sum();
    //println!("lib_sizes_vector:{:?}", lib_sizes_vector);
    for i in 0..lib_sizes_vector.ncols() {
        lib_sizes.push(lib_sizes_vector[(0, i)].into());
    }
    //println!("lib_sizes:{:?}", lib_sizes);
    //println!("min_sample_size:{}", min_sample_size);
    let median_lib_size = Data::new(lib_sizes.clone()).median();
    let cpm_cutoff = (min_count / median_lib_size) * 1000000.0;
    //println!("cpm_cutoff:{}", cpm_cutoff);
    let cpm_matrix = cpm(&raw_data);
    const TOL: f64 = 1e-14; // Value of constant from R implementation

    //let mut keep_cpm = Vec::<bool>::new();
    //let mut keep_total = Vec::<bool>::new();
    //let mut positive_cpm: usize = 0;
    //let mut positive_total: usize = 0;
    let mut positives = Vec::<usize>::new();
    let row_sums = raw_data.column_sum();
    for row in 0..cpm_matrix.nrows() {
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
        //else {
        //    keep_cpm.push(false)
        //}

        let mut keep_total_bool = false;
        if row_sums[(row, 0)] as f64 >= min_total_count - TOL {
            keep_total_bool = true;
            //keep_total.push(keep_total_bool);
            //positive_total += 1;
        }
        //else {
        //    keep_total.push(false)
        //}

        if keep_cpm_bool == true && keep_total_bool == true {
            positives.push(row);
        }
    }
    //println!("positives length:{}", positives.len());
    //println!("row_sums:{:?}", row_sums);
    //println!("keep_cpm:{:?}", keep_cpm);
    //println!("positive_cpm:{}", positive_cpm);
    //println!("negative_cpm:{}", keep_cpm.len() - positive_cpm);
    //println!("keep_total:{:?}", keep_total);
    //println!("positive_total:{}", positive_total);
    //println!("negative_total:{}", keep_total.len() - positive_total);
    let mut blank = Vec::with_capacity(positives.len() * (num_diseased + num_control));
    for _i in 0..positives.len() * (num_diseased + num_control) {
        blank.push(0.0);
    }
    let mut filtered_matrix = DMatrix::from_vec(positives.len(), num_diseased + num_control, blank);
    let mut filtered_gene_names: Vec<String> = Vec::with_capacity(positives.len());
    let mut i = 0;
    //println!("filtered_matrix rows:{}", filtered_matrix.nrows());
    //println!("filtered_matrix cols:{}", filtered_matrix.ncols());
    for index in positives {
        let row = raw_data.row(index);
        filtered_gene_names.push(gene_names[index].to_owned());
        let mut j = 0;
        for item in &row {
            //println!("index:{}", index);
            //println!("i:{}", i);
            //println!("j:{}", j);
            filtered_matrix[(i, j)] = *item;
            j += 1;
        }
        i += 1
    }

    // Modifying lib sizes with only those rows that have been retained
    let modified_lib_sizes_vector = filtered_matrix.row_sum();
    let mut modified_lib_sizes: Vec<f64> = Vec::with_capacity(modified_lib_sizes_vector.ncols());
    //println!("lib_sizes_vector:{:?}", lib_sizes_vector);
    for i in 0..modified_lib_sizes_vector.ncols() {
        modified_lib_sizes.push(modified_lib_sizes_vector[(0, i)].into());
    }
    //println!("filtered_matrix:{:?}", filtered_matrix);
    (filtered_matrix, modified_lib_sizes, filtered_gene_names)
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
