// cd .. && cargo build --release && json='{"samples":"SJMB030827,SJMB030838,SJMB032893,SJMB031131,SJMB031227","input_file":"/Users/rpaul1/pp_data/files/hg38/sjmb12/rnaseq/geneCounts2.txt"}' && time echo $json | target/release/gene_variance
#![allow(non_snake_case)]
use json;
use nalgebra::base::dimension::Dyn;
use nalgebra::base::Matrix;
use nalgebra::base::VecStorage;
use nalgebra::DMatrix;
use serde::{Deserialize, Serialize};
use serde_json;
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
    std_dev: f64,
}

fn calculate_variance(
    input_matrix: Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>>,
    gene_names: Vec<String>,
    gene_symbols: Vec<String>,
) -> Vec<GeneInfo> {
    let mut gene_infos = Vec::<GeneInfo>::new();
    for row in 0..input_matrix.nrows() {
        let mut gene_counts: Vec<f64> = Vec::with_capacity(input_matrix.ncols());
        for col in 0..input_matrix.ncols() {
            gene_counts.push(input_matrix[(row, col)]);
        }
        if gene_counts.clone().variance().is_nan() == true { // Should we add more conditions here for e.g filter genes with very low gene counts
        } else {
            gene_infos.push(GeneInfo {
                std_dev: gene_counts.variance(),
                gene_name: gene_names[row].clone(),
                gene_symbol: gene_symbols[row].clone(),
            });
        }
    }
    gene_infos.as_mut_slice().sort_by(|a, b| {
        (a.std_dev)
            .partial_cmp(&b.std_dev)
            .unwrap_or(Ordering::Equal)
    });
    gene_infos
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
                    let samples_string = &json_string["samples"]
                        .to_owned()
                        .as_str()
                        .unwrap()
                        .to_string();
                    let file_name = &json_string["input_file"]
                        .to_owned()
                        .as_str()
                        .unwrap()
                        .to_string()
                        .split(",")
                        .collect();
                    let samples_list: Vec<&str> = samples_string.split(",").collect();
                    let (input_matrix, gene_names, gene_symbols) =
                        input_data(file_name, &samples_list);
                    let gene_infos = calculate_variance(input_matrix, gene_names, gene_symbols);
                    //println!("gene_infos:{:?}", gene_infos);
                    let mut output_string = "[".to_string();
                    for j in 0..gene_infos.len() {
                        let i = gene_infos.len() - j - 1;
                        output_string += &serde_json::to_string(&gene_infos[i]).unwrap();
                        if i > 0 {
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
