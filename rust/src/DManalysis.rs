use serde_json::{self,Value};
use serde::{Deserialize, Serialize};
use std::io::{self,BufRead,BufReader};
use std::fs::File;
use std::str::FromStr;
use std::cmp::Ordering;
use std::collections::HashSet;
use nalgebra::DMatrix;
use nalgebra::base::dimension::Dyn;
use nalgebra::base::VecStorage;
use nalgebra::Matrix;
use statrs::statistics::Data;
use statrs::statistics::Distribution;


mod stats_functions; // Importing Wilcoxon function from stats_functions.rs


// return a list of indexes of eath item in another list
fn find_all_indexes<T: PartialEq>(outer_list: &[T], target_list: &[T]) -> Vec<usize> {
    target_list.iter().filter_map(|target_item| {
        outer_list.iter().position(|item| item == target_item)
    }).collect()
}


fn input_data(
    filename: String,
    case_list: Vec<&str>,
    control_list: Vec<&str>
) -> (
    Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>>,
    Vec<String>,
    Vec<String>,
    Vec<String>,
) {
    let mut input_vector: Vec<f64> = Vec::with_capacity(100 * 20000);
    let mut metabolite_names: Vec<String> = Vec::with_capacity(20000);
    let file = File::open(filename).expect("Metabolites intensity data file couldn't be opened");
    let mut reader = BufReader::new(file);
    let mut first_line = String::new();
    reader.read_line(&mut first_line).expect("Failed to read the first line of data file");
    let header: Vec<&str> = first_line.trim_end().split("\t").collect();
    let header_hs: HashSet<_> = header.iter().cloned().collect();
    // filter case and control sample (if sample exists in header line)
    let case_list_filtered: Vec<&str> = case_list
                                    .iter()
                                    .filter(|x| header_hs.contains(*x))
                                    .copied()
                                    .collect();
    let control_list_filtered: Vec<&str> = control_list
                                    .iter()
                                    .filter(|x| header_hs.contains(*x))
                                    .copied()
                                    .collect();

    // combine case and control into one list
    let mut case_control_list = case_list_filtered.clone();
    case_control_list.extend(control_list_filtered.clone());
    let case_control_indexes: Vec<usize> = find_all_indexes(&header,&case_control_list);
    
    let metabolite_index: usize = header.iter().position(|x| x == &"#Metabolites").expect("#Metabolites is not in header!");

    for line in reader.lines() {
        match line {
            Ok(content) => {
                let columns = content.trim_end().split("\t").collect::<Vec<&str>>();
                metabolite_names.push(columns[metabolite_index].to_string());
                for (i,sam_idx) in case_control_indexes.iter().enumerate() {
                    let num = FromStr::from_str(columns[*sam_idx]);
                    match num {
                        Ok(n) => {
                            input_vector.push(n);
                        }
                        Err(_err) => {
                            panic!(
                                "Metabolite intensity value of {} for sample {} is not a decimal number",
                                columns[*sam_idx].to_owned(),
                                case_control_list[i].to_owned()
                            );
                        }
                    }
                }
            }
            Err(err) => {
                eprintln!("Error reading data file: {}",err);
            }
        }
    };
    let dm = DMatrix::from_row_slice(metabolite_names.len(),case_control_list.len(),&input_vector);
    let case_list_final: Vec<String> = case_list_filtered
                                        .iter()
                                        .map(|x| x.to_string())
                                        .collect();
    let control_list_final: Vec<String> = control_list_filtered
                                        .iter()
                                        .map(|x| x.to_string())
                                        .collect();
    (dm, metabolite_names,case_list_final,control_list_final)

}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
struct AdjustedPValueIndexes {
    index: usize,
    metabolite: String,
    fold_change: f64,
    original_p_value: f64,
    adjusted_p_value: f64,
}

struct PValueIndexes {
    index: usize,
    metabolite: String,
    fold_change: f64,
    p_value: f64,
}

fn main() {
    const THRESHOLD: usize = 50; // This determines whether the Wilcoxon exact test or the normal test will be used based on sample size.
    let mut input = String::new();
    io::stdin().read_line(&mut input).expect("Piping error");
    let input_json = serde_json::from_str::<Value>(&input).expect("Error reading input and serializing to JSON");
    let case_str: String = input_json.get("case").expect("No case sample list from input").to_string().replace("\"","");
    let case_list: Vec<&str> = case_str
                                .split(",")
                                .collect();
    let control_str: String = input_json.get("control").expect("No case sample list from input").to_string().replace("\"","");
    let control_list: Vec<&str> = control_str
                                .split(",")
                                .collect();
    let file_name: String = input_json.get("input_file").expect("No case sample list from input").to_string().replace("\"","");
    let (input_matrix,metabolite_names,case_list_filtered,control_list_filtered) = input_data(file_name, case_list, control_list);
    // select case and control data for wilcoxon_rank_sum_test
    let mut p_values: Vec<PValueIndexes> = Vec::with_capacity(input_matrix.nrows());
    for i in 0..input_matrix.nrows() {
        let row = input_matrix.row(i);
        let mut case = Vec::<f64>::new();
        for j in 0..case_list_filtered.len() {
            case.push(row[(0,j)]);
        };
        let mut control = Vec::<f64>::new();
        for j in 0..control_list_filtered.len() {
            control.push(row[(0,j+case_list_filtered.len())])
        };
        let p_value = stats_functions::wilcoxon_rank_sum_test(
            case.clone(),
            control.clone(),
            THRESHOLD,
            't',
            true,
        );
        let case_mean = Data::new(case).mean();
        let control_mean = Data::new(control).mean();
        let log2fc = (case_mean.unwrap() / control_mean.unwrap()).log2();
        if !log2fc.is_nan() && !log2fc.is_infinite() {
            p_values.push(PValueIndexes {
                index: i,
                metabolite: metabolite_names[i].to_owned(),
                fold_change: log2fc,
                p_value: p_value,
            });
        };
    };
    let adjusted_p_values =  adjusted_p_values(p_values);
    println!("adjusted_p_values:{}",adjusted_p_values);

}

fn adjusted_p_values(mut original_p_values: Vec<PValueIndexes>) -> String {
    // Sorting p-values in ascending order
    original_p_values.as_mut_slice().sort_by(|a,b| {
        (a.p_value)
            .partial_cmp(&b.p_value)
            .unwrap_or(Ordering::Equal)
    });
    let mut adjusted_p_values: Vec<AdjustedPValueIndexes> = Vec::with_capacity(original_p_values.len());
    let pval_n: f64 = original_p_values.len() as f64;
    for (i,p) in original_p_values.iter().enumerate() {
        let rank: f64 = (i + 1) as f64;
        let mut adjusted_p_value: f64 = p.p_value * pval_n / rank;
        if adjusted_p_value > 1.0 {
            adjusted_p_value = 1.0
        };
        adjusted_p_values.push(AdjustedPValueIndexes{
            index: p.index,
            fold_change: p.fold_change,
            metabolite: p.metabolite.to_owned(),
            original_p_value: (-1.0) * p.p_value.log10(),
            adjusted_p_value: (-1.0) * adjusted_p_value.log10()
        });
    }
    adjusted_p_values.sort_by(|a, b| a.index.cmp(&b.index));
    let mut output_string = "[".to_string();
    for (i,ap) in adjusted_p_values.iter().enumerate() {
        output_string += &serde_json::to_string(&ap).unwrap();
        if i < (pval_n as usize - 1) {
            output_string += &",".to_string();
        };
    };
    output_string += &"]".to_string();
    output_string
}
