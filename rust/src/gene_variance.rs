/*
 This script selects the top most variant genes by calculating the variance/interquartile region for each gene.

Various JSON parameters:
   samples: Enter the sample ID(s) separated by comma
   input_file: Path to input file
   filter_extreme_values: boolean (true/false). When true, this filter according to logic filterbyExpr in edgeR. This basically removes genes that have very low gene counts.
   num_genes: The top num_genes (for e.g 10) that need to be reported in the output.
   param: var/iqr . This parameter decides whether to sort genes using variance or interquartile region. There is an article which states that its better to use interquartile region than variance for selecting genes for clustering https://www.frontiersin.org/articles/10.3389/fgene.2021.632620/full

 Example syntax: cd .. && cargo build --release && json='{"samples":"sample1,sample2,sample3","input_file":"/path/to/input/file","filter_extreme_values":true,"num_genes":100, "param":"var"}' && time echo $json | target/release/gene_variance
*/
#![allow(non_snake_case)]
use json;
use nalgebra::base::dimension::Dyn;
use nalgebra::base::Matrix;
use nalgebra::base::VecStorage;
use nalgebra::DMatrix;
use serde::{Deserialize, Serialize};
use serde_json;
use statrs::statistics::Data;
use statrs::statistics::Median;
use statrs::statistics::OrderStatistics;
use statrs::statistics::Statistics;
use std::cmp::Ordering;
use std::io;
use std::path::Path;
use std::str::FromStr;
use std::time::Instant;

fn input_data(
    filename: &String,
    sample_list: &Vec<&str>,
) -> (
    Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>>,
    Vec<String>,
    Vec<String>,
) {
    // Build the CSV reader and iterate over each record.
    let path = Path::new(filename);
    let mut rdr = csv::Reader::from_path(path).unwrap();
    let mut num_lines: usize = 0;
    let mut input_vector: Vec<f64> = Vec::with_capacity(500 * 65000);
    let mut gene_names: Vec<String> = Vec::with_capacity(65000);
    let mut gene_symbols: Vec<String> = Vec::with_capacity(65000);
    let mut num_columns: usize = 0;

    // Check headers for samples
    let header_line = rdr.headers().unwrap();
    let mut headers: Vec<&str> = Vec::with_capacity(1500);
    for field in header_line.iter() {
        headers = field.split('\t').collect::<Vec<&str>>();
    }
    //println!("headers:{:?}", headers);
    let mut sample_indexes_original: Vec<usize> = Vec::with_capacity(sample_list.len());
    let gene_name_index = headers.iter().position(|r| r == &"geneID");
    let gene_symbol_index = headers.iter().position(|r| r == &"geneSymbol");
    //let mut case_samples_not_found: Vec<&str> = Vec::with_capacity(sample_list.len());
    //let mut control_samples_not_found: Vec<&str> = Vec::with_capacity(control_list.len());

    for item in sample_list {
        //println!("item:{}", item);
        let index = headers.iter().position(|r| r == item);
        match index {
            Some(n) => sample_indexes_original.push(n),
            None => {
                //panic!("Case sample not found:{}", item);
                //case_samples_not_found.push(item);
            }
        }
    }

    //println!("case_indexes_original:{:?}", case_indexes_original);

    let mut samples_indexes: Vec<usize> = Vec::with_capacity(sample_list.len());
    for result in rdr.records() {
        // The iterator yields Result<StringRecord, Error>, so we check the
        // error here.
        let record = result.unwrap();
        //println!("record:{:?}", record);
        let mut index = 0;
        for field in record[0].split('\t').collect::<Vec<&str>>() {
            if index == gene_name_index.unwrap() {
                gene_names.push(field.to_string());
            } else if index == gene_symbol_index.unwrap() {
                gene_symbols.push(field.to_string());
            } else if sample_indexes_original.contains(&index) {
                let num = FromStr::from_str(field);
                match num {
                    Ok(n) => {
                        //println!("n:{}", n);
                        input_vector.push(n);
                        if num_lines == 0 {
                            samples_indexes.push(num_columns);
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
    //println!("case_indexes:{:?}", case_indexes);
    //println!("control_indexes:{:?}", control_indexes);

    let dm = DMatrix::from_row_slice(num_lines, num_columns, &input_vector);
    //println!("dm:{:?}", dm);
    (dm, gene_names, gene_symbols)
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
struct GeneInfo {
    gene_name: String,
    gene_symbol: String,
    param: f64,
}

fn calculate_variance(
    input_matrix: Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>>,
    gene_names: Vec<String>,
    gene_symbols: Vec<String>,
    mut min_sample_size: f64,
    filter_extreme_values: bool,
    param: String,
) -> Vec<GeneInfo> {
    const MIN_COUNT: f64 = 10.0; // Value of constant from R implementation
    const MIN_TOTAL_COUNT: f64 = 15.0; // Value of constant from R implementation
    const LARGE_N: f64 = 10.0; // Value of constant from R implementation
    const MIN_PROP: f64 = 0.7; // Value of constant from R implementation

    if min_sample_size == 0.0 {
        panic!("Only one condition present in groups");
    }

    if min_sample_size > LARGE_N {
        min_sample_size = LARGE_N + (min_sample_size - LARGE_N) * MIN_PROP;
    }

    let mut lib_sizes = Vec::<f64>::new();
    let lib_sizes_vector = input_matrix.row_sum();
    //println!("lib_sizes_vector:{:?}", lib_sizes_vector);
    for i in 0..lib_sizes_vector.ncols() {
        lib_sizes.push(lib_sizes_vector[(0, i)].into());
    }
    //println!("lib_sizes:{:?}", lib_sizes);
    //println!("min_sample_size:{}", min_sample_size);
    let median_lib_size = Data::new(lib_sizes.clone()).median();
    let cpm_cutoff = (MIN_COUNT / median_lib_size) * 1000000.0;
    //println!("cpm_cutoff:{}", cpm_cutoff);
    let cpm_matrix = cpm(&input_matrix);
    const TOL: f64 = 1e-14; // Value of constant from R implementation

    let mut gene_infos = Vec::<GeneInfo>::new();
    let row_sums = input_matrix.column_sum();
    for row in 0..input_matrix.nrows() {
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

        let mut keep_total_bool = false;
        if row_sums[(row, 0)] as f64 >= MIN_TOTAL_COUNT - TOL {
            keep_total_bool = true;
            //keep_total.push(keep_total_bool);
            //positive_total += 1;
        }

        let mut gene_counts: Vec<f64> = Vec::with_capacity(input_matrix.ncols());
        for col in 0..input_matrix.ncols() {
            gene_counts.push(input_matrix[(row, col)]);
        }
        if param == "var" {
            // Calculating variance
            if gene_counts.clone().variance().is_nan() == true {
            } else if filter_extreme_values == true
                && keep_cpm_bool == true
                && keep_total_bool == true
            {
                gene_infos.push(GeneInfo {
                    param: gene_counts.variance(),
                    gene_name: gene_names[row].clone(),
                    gene_symbol: gene_symbols[row].clone(),
                });
            } else if filter_extreme_values == false {
                gene_infos.push(GeneInfo {
                    param: gene_counts.variance(),
                    gene_name: gene_names[row].clone(),
                    gene_symbol: gene_symbols[row].clone(),
                });
            }
        } else {
            // Calculating interquartile region
            let mut gene_counts_data = Data::new(gene_counts);
            if gene_counts_data.clone().interquartile_range().is_nan() == true {
            } else if filter_extreme_values == true
                && keep_cpm_bool == true
                && keep_total_bool == true
            {
                gene_infos.push(GeneInfo {
                    param: gene_counts_data.interquartile_range(),
                    gene_name: gene_names[row].clone(),
                    gene_symbol: gene_symbols[row].clone(),
                });
            } else if filter_extreme_values == false {
                gene_infos.push(GeneInfo {
                    param: gene_counts_data.interquartile_range(),
                    gene_name: gene_names[row].clone(),
                    gene_symbol: gene_symbols[row].clone(),
                });
            }
        }
    }
    gene_infos
        .as_mut_slice()
        .sort_by(|a, b| (a.param).partial_cmp(&b.param).unwrap_or(Ordering::Equal));
    gene_infos
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
            output_matrix[(row, col)] =
                (input_matrix[(row, col)] as f64 * 1000000.0) / norm_factor as f64;
        }
    }
    //println!("output_matrix:{:?}", output_matrix);
    output_matrix
}

fn main() {
    let mut input = String::new();
    match io::stdin().read_line(&mut input) {
        // Accepting the piped input from nodejs (or command line from testing)
        Ok(_bytes_read) => {
            //println!("{} bytes read", bytes_read);
            //println!("{}", input);
            let input_json = json::parse(&input);
            match input_json {
                Ok(json_string) => {
                    let now = Instant::now();
                    let samples_string_result = &json_string["samples"].to_owned();
                    let samples_string;
                    match samples_string_result.as_str() {
                        Some(x) => {
                            samples_string = x.to_string();
                        }
                        None => {
                            panic!("Samples not provided");
                        }
                    }

                    let file_name_result = &json_string["input_file"];
                    let file_name;
                    match file_name_result.as_str() {
                        Some(x) => {
                            file_name = x.to_string();
                        }
                        None => {
                            panic!("File name is missing");
                        }
                    }

                    let param = &json_string["param"] // Value provide must be either "var" or "iqr"
                        .to_owned()
                        .as_str()
                        .unwrap()
                        .to_string();
                    if param != "var" && param != "iqr" {
                        // Check if any unknown method has been provided
                        panic!("Unknown method:{}", param);
                    }
                    let filter_extreme_values_result = &json_string["filter_extreme_values"];

                    let filter_extreme_values;
                    match filter_extreme_values_result.as_bool() {
                        Some(x) => {
                            filter_extreme_values = x;
                        }
                        None => {
                            filter_extreme_values = true; // If filter_extreme_values field is missing, set it to true by default
                        }
                    }

                    let num_genes_result = &json_string["num_genes"];
                    let num_genes;
                    match num_genes_result.as_usize() {
                        Some(x) => {
                            num_genes = x;
                        }
                        None => {
                            panic!("Number of genes to be given is missing")
                        }
                    }

                    let samples_list: Vec<&str> = samples_string.split(",").collect();
                    let (input_matrix, gene_names, gene_symbols) =
                        input_data(&file_name, &samples_list);
                    let gene_infos = calculate_variance(
                        input_matrix,
                        gene_names,
                        gene_symbols,
                        samples_list.len() as f64,
                        filter_extreme_values,
                        param.to_string(),
                    );
                    //println!("gene_infos:{:?}", gene_infos);

                    // Printing the top "num_genes" genes to JSON
                    let mut output_string = "[".to_string();
                    for j in 0..num_genes {
                        let i = gene_infos.len() - j - 1;
                        output_string += &serde_json::to_string(&gene_infos[i]).unwrap();
                        if i > gene_infos.len() - num_genes {
                            output_string += &",".to_string();
                        }
                    }
                    output_string += &"]".to_string();
                    println!("{}", output_string);
                    println!("Time for calculating variances:{:?}", now.elapsed());
                }
                Err(error) => println!("Incorrect json: {}", error),
            }
        }
        Err(error) => println!("Piping error: {}", error),
    }
}
