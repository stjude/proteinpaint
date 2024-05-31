/*
 This script selects the top most variant metabolite by calculating the variance/interquartile region for each metabolite.

Various JSON parameters:
   samples: Enter the sample ID(s) separated by comma
   input_file: Path to input file(txt file instead of *.gz file)
   num_metabolites: The top num_metabolites that need to be reported in the output(optional. 20 by default).
   param: var/iqr . This parameter decides whether to sort metabolites using variance or interquartile region. There is an article which states that its better to use interquartile region than variance for selecting genes for clustering https://www.frontiersin.org/articles/10.3389/fgene.2021.632620/full

 Example syntax: cd .. && cargo build --release && json='{"samples":"sample1,sample2,sample3","input_file":"/path/to/input/file","filter_extreme_values":true,"param":"var"}' && time echo $json | target/release/computeTopTerms
*/

#![allow(non_snake_case)]
use serde_json::{self,Value};
use serde::{Serialize,Deserialize};
use std::io::{self, BufReader, BufRead};
use std::fs::File;
use nalgebra::base::dimension::Dyn;
use nalgebra::base::Matrix;
use nalgebra::base::VecStorage;
use nalgebra::DMatrix;
use std::str::FromStr;
use std::cmp::Ordering;
use statrs::statistics::Data;
use statrs::statistics::OrderStatistics;
use statrs::statistics::Statistics;

fn input_data(
	filename: &String,
	sample_list: &Vec<&str>,
) -> (
	Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>>,
	Vec<String>,
) {
	let mut num_lines: usize = 0;
	let mut metabolites: Vec<String> = Vec::with_capacity(500);
	let file = File::open(filename).expect("Reading metabolite intensity file error!");
	let reader = BufReader::new(file);
	let mut input_vector: Vec<f64> = Vec::with_capacity(1000 * 500);
	let mut column_numbers: Vec<usize> = Vec::with_capacity(300);
	for line in reader.lines() {
		let line_str = line.expect("line reading error");
		let columns: Vec<&str> = line_str.split("\t").collect();
		// Finding column numbers corresponding to each sample given in the input list
		if columns[0] == "#Metabolites" {
			for sam in sample_list {
				if let Some(index) = columns.iter().position(|s| s == sam) {
					column_numbers.push(index)
				} else {
					panic!("Sample {} not found:", sam);
				}
			}
		} else {
			num_lines += 1;
			metabolites.push(columns[0].to_string());
			for i in &column_numbers {
				let intensity = columns[*i];
				let intensity_num = FromStr::from_str(intensity);
				match intensity_num {
					Ok(n) => {
						input_vector.push(n);
					}
					Err(_) => {
						panic!(
							"Number {} in line {} and column {} is not a decimal number",
							intensity,
							num_lines + 1,
							i + 1
						)
					}
				}
			}
		}
	};
	let dm = DMatrix::from_row_slice(num_lines, sample_list.len(), &input_vector);
	(dm, metabolites)
}

#[derive(Debug, Serialize, Deserialize)]
struct MetaboliteInfo {
	metabolite: String,
	param: f64,
}
fn calculate_variance(
	input_matrix: Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>>,
    metabolites: Vec<String>,
    param: String,
) -> Vec<MetaboliteInfo> {
	let mut metabolite_infos = Vec::<MetaboliteInfo>::new();
	for row in 0..input_matrix.nrows() {
		let mut metabolite_counts: Vec<f64> = Vec::with_capacity(input_matrix.ncols());
		for col in 0..input_matrix.ncols() {
			metabolite_counts.push(input_matrix[(row, col)]);
		}
		if param == "var" {
			// Calculating variance
				metabolite_infos.push(MetaboliteInfo {
					metabolite: metabolites[row].clone(),
					param: metabolite_counts.clone().variance(),
				});
		} else {
			// Calculating interquartile region
			let metabolite_counts_data = Data::new(metabolite_counts);
			metabolite_infos.push(MetaboliteInfo {
					metabolite: metabolites[row].clone(),
					param: metabolite_counts_data.clone().interquartile_range(),
				});
			
		}
	}
	metabolite_infos
		.as_mut_slice()
		.sort_by(|a, b| (a.param).partial_cmp(&b.param).unwrap_or(Ordering::Equal));
	//println!("{:?}",metabolite_infos);
	metabolite_infos
}

fn main() {
	let mut input = String::new();
	io::stdin().read_line(&mut input).expect("Piping error");
	let input_json = serde_json::from_str::<Value>(&input).expect("Error reading input and serializing to JSON");
	let sample_string = &input_json.get("samples").expect("samples is missed from input JSON").to_owned().to_string().trim_matches('"').to_string();
	let file_name = &input_json.get("input_file").expect("input_file is missed from input JSON").to_owned().to_string().trim_matches('"').to_string();
	let param = &input_json.get("param").expect("param is missed from input JSON").to_owned().to_string().trim_matches('"').to_string();
	if param != "var" && param != "iqr" {
		panic!("Unknown method:{}", param); // Check if any unknown method has been provided
	};
	let num_metabolites = match input_json.get("num_metabolites") {
		Some(value) => {
			let string_value = value.as_str().expect("Invalid value type for 'num_metabolites'");
			string_value.parse::<usize>().expect("Invalid number of metabolites")
		}
		None => 20
	};
	let samples_list: Vec<&str> = sample_string.split(",").collect();
	let (input_matrix, metabolites) = input_data(&file_name, &samples_list);
	let metabolite_infos = calculate_variance(
		input_matrix,
		metabolites,
		param.to_string(),
	);
	let mut output_string = "[".to_string();
	for j in 0..num_metabolites {
		let i = metabolite_infos.len() - j - 1;
		output_string += &serde_json::to_string(&metabolite_infos[i]).unwrap();
		if i > metabolite_infos.len() - num_metabolites {
			output_string += &",".to_string();
		}
	}
	output_string += &"]".to_string();
	println!("output_json:{}", output_string);
}
