/*
##########################
# Wilcoxon rank sum test #
##########################

##########################
# Documentation
##########################

This wilcoxon test implementation aims to copy the methodology used in R's wilcox_test() function

#########
# Usage #
#########

# Usage: cd .. && cargo build --release && time echo '[{"group1_id":"European Ancestry","group1_values":[3.7,2.5,5.9,13.1,1,10.6,3.2,3,6.5,15.5,2.6,16.5,2.6,4,8.6,8.3,1.9,7.9,7.9,6.1,17.6,3.1,3,1.5,8.1,18.2,-1.8,3.6,6,1.9,8.9,3.2,0.3,-1,11.2,6.2,16.2,7.5,9,9.4,18.9,0.1,11.5,10.1,12.5,14.6,1.5,17.3,15.4,7.6,2.4,13.5,3.8,17],"group2_id":"African Ancestry","group2_values":[11.5,5.1,21.1,4.4,-0.04]},{"group1_id":"European Ancestry","group1_values":[3.7,2.5,5.9,13.1,1,10.6,3.2,3,6.5,15.5,2.6,16.5,2.6,4,8.6,8.3,1.9,7.9,7.9,6.1,17.6,3.1,3,1.5,8.1,18.2,-1.8,3.6,6,1.9,8.9,3.2,0.3,-1,11.2,6.2,16.2,7.5,9,9.4,18.9,0.1,11.5,10.1,12.5,14.6,1.5,17.3,15.4,7.6,2.4,13.5,3.8,17],"group2_id":"Asian Ancestry","group2_values":[1.7]},{"group1_id":"African Ancestry","group1_values":[11.5,5.1,21.1,4.4,-0.04],"group2_id":"Asian Ancestry","group2_values":[]}]' | target/release/wilcoxon

# Several examples are present in test_examples.rs. This can be tested using the command: cd .. && cargo build --release && time cargo test

# Input data is in JSON format and is read in from <in.json> file.
# Results are written in JSON format to stdout.

# Input JSON specifications:
# [{
#   group1_id: group1 id,
#   group1_values: [] group1 data values,
#   group2_id: group2 id,
#   group2_values: [] group2 data values
# }]
#
# Output JSON specifications:
# [{
#   group1_id: group1 id,
#   group1_values: [] group1 data values,
#   group2_id: group2 id,
#   group2_values: [] group2 data values,
#   pvalue: p-value of test
# }]


########
# Code #
########
*/

use json;
use serde::{Deserialize, Serialize};
use std::io;

mod stats_functions; // Import Wilcoxon function
#[cfg(test)]
mod test_examples; // Contains examples to test the wilcoxon rank sum test

#[derive(Debug, Serialize, Deserialize)]
struct OutputJson {
    // Output JSON data structure
    group1_id: String,
    group2_id: String,
    group1_values: Vec<f64>,
    group2_values: Vec<f64>,
    pvalue: Option<f64>,
}

//#[derive(Debug)]
//struct RankFreq {
//    rank: f64,
//    freq: usize,
//}

fn main() {
    let mut input = String::new();
    match io::stdin().read_line(&mut input) {
        // Accepting the piped input from nodejs (or command line from testing)
        Ok(_n) => {
            //println!("{} bytes read", n);
            //println!("input:{}", input);
            const THRESHOLD: usize = 50; // Decrease this number so as to invoke the normal approximation for lower sample sizes. This would speed up the test at the cost of sacrificing accuracy.
            let input_json = json::parse(&input);
            match input_json {
                Ok(json_string) => {
                    //println!("{} bytes read", n);
                    //println!("json_string:{}", json_string);

                    let mut output_string = "[".to_string();
                    for i in 0..json_string.len() {
                        //println!("group1_id:{}", json_string[i]["group1_id"]);
                        //println!("group2_id:{}", json_string[i]["group2_id"]);
                        //println!("group1_values:{}", json_string[i]["group1_values"]);
                        //println!("group2_values:{}", json_string[i]["group2_values"]);
                        let mut vec1 = Vec::<f64>::new();
                        let mut vec2 = Vec::<f64>::new();

                        for arr_iter in 0..json_string[i]["group1_values"].len() {
                            vec1.push(json_string[i]["group1_values"][arr_iter].as_f64().unwrap());
                        }
                        for arr_iter in 0..json_string[i]["group2_values"].len() {
                            vec2.push(json_string[i]["group2_values"][arr_iter].as_f64().unwrap());
                        }
                        //println!("vec1:{:?}", vec1);
                        //println!("vec2:{:?}", vec2);

                        if vec1.len() == 0 || vec2.len() == 0 {
                            // If one of the vectors has a length of zero, wilcoxon test is not performed and a pvalue of NULL is given.
                            output_string += &serde_json::to_string(&OutputJson {
                                group1_id: json_string[i]["group1_id"].as_str().unwrap().to_string(),
                                group2_id: json_string[i]["group2_id"].as_str().unwrap().to_string(),
                                group1_values: vec1,
                                group2_values: vec2,
                                pvalue: None,
                            })
                            .unwrap();
                            output_string += &",".to_string();
                        } else {
                            let pvalue: f64 = stats_functions::wilcoxon_rank_sum_test(
                                vec1.clone(),
                                vec2.clone(),
                                THRESHOLD,
                                't', // two-sided test
                                true,
                            );

                            //if pvalue > 0.01 {
                            //    pvalue = format!("{:.4}", pvalue).parse().unwrap();
                            //}
                            //println!("pvalue:{}", pvalue);
                            output_string += &serde_json::to_string(&OutputJson {
                                group1_id: json_string[i]["group1_id"].as_str().unwrap().to_string(),
                                group2_id: json_string[i]["group2_id"].as_str().unwrap().to_string(),
                                group1_values: vec1,
                                group2_values: vec2,
                                pvalue: Some(pvalue),
                            })
                            .unwrap();
                            output_string += &",".to_string();
                        }
                    }
                    output_string.pop();
                    output_string += &"]".to_string();
                    println!("{}", output_string);
                }
                Err(error) => println!("Incorrect json: {}", error),
            }
        }
        Err(error) => println!("Piping error: {}", error),
    }
}
