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
use serde_json;
use std::fs;
use std::io;
use std::io::Read;
use std::str::FromStr;
use std::time::Instant;
mod stats_functions; // Importing calculate_variance function from stats_functions.rs

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
                    let gene_infos = stats_functions::calculate_variance(
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
