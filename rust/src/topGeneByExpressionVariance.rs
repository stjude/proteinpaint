/*
 This script selects the top most variant genes by calculating the variance/interquartile region for each gene.

Various JSON parameters:
   samples: Enter the sample ID(s) separated by comma
   input_file: Path to input file
   filter_extreme_values: boolean (true/false). When true, this filter according to logic filterbyExpr in edgeR. This basically removes genes that have very low gene counts.
   num_genes: The top num_genes (for e.g 10) that need to be reported in the output.
   rank_type: var/iqr . This parameter decides whether to sort genes using variance or interquartile region. There is an article which states that its better to use interquartile region than variance for selecting genes for clustering https://www.frontiersin.org/articles/10.3389/fgene.2021.632620/full

 Example syntax: cd .. && cargo build --release && json='{"samples":"sample1,sample2,sample3","min_count":30,"min_total_count":20,"input_file":"/path/to/input/file","filter_extreme_values":true,"num_genes":100, "rank_type":"var"}' && time echo $json | target/release/gene_variance
*/
#![allow(non_snake_case)]
use bgzip::BGZFReader;
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
use std::fs;
use std::io;
use std::io::Read;
use std::str::FromStr;
use std::time::Instant;

fn input_data(
    filename: &String,
    sample_list: &Vec<&str>,
) -> (
    Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>>,
    Vec<String>,
) {
    // Build the CSV reader and iterate over each record.
    let mut reader = BGZFReader::new(fs::File::open(filename).unwrap()).unwrap();
    let mut num_lines: usize = 0;
    let mut gene_symbols: Vec<String> = Vec::with_capacity(500);

    let mut buffer = String::new();
    reader.read_to_string(&mut buffer).unwrap();

    let lines = buffer.split("\n");
    let mut first = true;
    let mut input_vector: Vec<f64> = Vec::with_capacity(1000 * 500);
    let mut column_numbers: Vec<usize> = Vec::with_capacity(300);
    for line in lines {
        if first == true {
            first = false;
            let columns: Vec<&str> = line.split("\t").collect();
            // Finding column numbers corresponding to each sample given in the input list
            for item in sample_list {
                if let Some(index) = columns.iter().position(|num| num == item) {
                    column_numbers.push(index)
                } else {
                    panic!("Sample {} not found:", item)
                }
            }
        } else {
            let line2: Vec<&str> = line.split("\t").collect();
            if line2.len() == 1 {
                break; // end of file
            } else {
                num_lines += 1;
                //println!("line2:{:?}", line2);
                gene_symbols.push(line2[3].to_string());
                for i in &column_numbers {
                    let field = line2[*i];
                    let num = FromStr::from_str(field);
                    match num {
                        Ok(n) => {
                            //println!("n:{}", n);
                            input_vector.push(n);
                        }
                        Err(_n) => {
                            panic!(
                                "Number {} in line {} and column {} is not a decimal number",
                                field,
                                num_lines + 1,
                                i + 1
                            );
                        }
                    }
                }
            }
        }
    }

    //println!("case_indexes:{:?}", case_indexes);
    //println!("control_indexes:{:?}", control_indexes);

    let dm = DMatrix::from_row_slice(num_lines, sample_list.len(), &input_vector);
    //println!("dm:{:?}", dm);
    (dm, gene_symbols)
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
struct GeneInfo {
    gene_symbol: String,
    rank_type: f64,
}

fn calculate_variance(
    input_matrix: Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>>,
    gene_symbols: Vec<String>,
    mut min_sample_size: f64,
    filter_extreme_values: bool,
    rank_type: String,
    min_count_option: Option<f64>,
    min_total_count_option: Option<f64>,
) -> Vec<GeneInfo> {
    let mut min_count: f64 = 10.0;
    match min_count_option {
        Some(x) => min_count = x,
        None => {}
    }
    let mut min_total_count: f64 = 15.0;
    match min_total_count_option {
        Some(x) => min_total_count = x,
        None => {}
    }
    //const MIN_COUNT: f64 = 10.0; // Value of constant from R implementation
    //const MIN_TOTAL_COUNT: f64 = 15.0; // Value of constant from R implementation
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
    let cpm_cutoff = (min_count / median_lib_size) * 1000000.0;
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
        if row_sums[(row, 0)] as f64 >= min_total_count - TOL {
            keep_total_bool = true;
            //keep_total.push(keep_total_bool);
            //positive_total += 1;
        }

        let mut gene_counts: Vec<f64> = Vec::with_capacity(input_matrix.ncols());
        for col in 0..input_matrix.ncols() {
            gene_counts.push(input_matrix[(row, col)]);
        }
        if rank_type == "var" {
            // Calculating variance
            if gene_counts.clone().variance().is_nan() == true {
            } else if filter_extreme_values == true
                && keep_cpm_bool == true
                && keep_total_bool == true
            {
                gene_infos.push(GeneInfo {
                    rank_type: gene_counts.variance(),
                    gene_symbol: gene_symbols[row].clone(),
                });
            } else if filter_extreme_values == false {
                gene_infos.push(GeneInfo {
                    rank_type: gene_counts.variance(),
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
                    rank_type: gene_counts_data.interquartile_range(),
                    gene_symbol: gene_symbols[row].clone(),
                });
            } else if filter_extreme_values == false {
                gene_infos.push(GeneInfo {
                    rank_type: gene_counts_data.interquartile_range(),
                    gene_symbol: gene_symbols[row].clone(),
                });
            }
        }
    }
    gene_infos.as_mut_slice().sort_by(|a, b| {
        (a.rank_type)
            .partial_cmp(&b.rank_type)
            .unwrap_or(Ordering::Equal)
    });
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

                    let rank_type = &json_string["rank_type"] // Value provide must be either "var" or "iqr"
                        .to_owned()
                        .as_str()
                        .unwrap()
                        .to_string();
                    if rank_type != "var" && rank_type != "iqr" {
                        // Check if any unknown method has been provided
                        panic!("Unknown method:{}", rank_type);
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

                    let min_count_result = &json_string["min_count"];
                    let mut min_count: Option<f64> = None;
                    match min_count_result.as_f64() {
                        Some(x) => min_count = Some(x),
                        None => {}
                    }

                    let min_total_count_result = &json_string["min_total_count"];
                    let mut min_total_count: Option<f64> = None;
                    match min_total_count_result.as_f64() {
                        Some(x) => min_total_count = Some(x),
                        None => {}
                    }

                    let samples_list: Vec<&str> = samples_string.split(",").collect();
                    let (input_matrix, gene_symbols) = input_data(&file_name, &samples_list);
                    let gene_infos = calculate_variance(
                        input_matrix,
                        gene_symbols,
                        samples_list.len() as f64,
                        filter_extreme_values,
                        rank_type.to_string(),
                        min_count,
                        min_total_count,
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
                    println!("output_json:{}", output_string);
                    println!("Time for calculating variances:{:?}", now.elapsed());
                }
                Err(error) => println!("Incorrect json: {}", error),
            }
        }
        Err(error) => println!("Piping error: {}", error),
    }
}
