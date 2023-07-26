/*
##########################
# Wilcoxon rank sum test #
##########################

##########################
# Documentation
##########################

This implementation is based on the book Nonparametric Statistical Analysis (page 115). The advantage of this implementation is that it can even calculate p-values in case of TIES (where same number is repeated in both input vectors or within same vector). See page 124.
Book link: https://onlinelibrary.wiley.com/doi/epdf/10.1002/9781119196037

#########
# Usage #
#########

# Usage: cd .. && cargo build --release && time echo '[{"group1_id":"European Ancestry","group1_values":[3.7,2.5,5.9,13.1,1,10.6,3.2,3,6.5,15.5,2.6,16.5,2.6,4,8.6,8.3,1.9,7.9,7.9,6.1,17.6,3.1,3,1.5,8.1,18.2,-1.8,3.6,6,1.9,8.9,3.2,0.3,-1,11.2,6.2,16.2,7.5,9,9.4,18.9,0.1,11.5,10.1,12.5,14.6,1.5,17.3,15.4,7.6,2.4,13.5,3.8,17],"group2_id":"African Ancestry","group2_values":[11.5,5.1,21.1,4.4,-0.04]},{"group1_id":"European Ancestry","group1_values":[3.7,2.5,5.9,13.1,1,10.6,3.2,3,6.5,15.5,2.6,16.5,2.6,4,8.6,8.3,1.9,7.9,7.9,6.1,17.6,3.1,3,1.5,8.1,18.2,-1.8,3.6,6,1.9,8.9,3.2,0.3,-1,11.2,6.2,16.2,7.5,9,9.4,18.9,0.1,11.5,10.1,12.5,14.6,1.5,17.3,15.4,7.6,2.4,13.5,3.8,17],"group2_id":"Asian Ancestry","group2_values":[1.7]},{"group1_id":"African Ancestry","group1_values":[11.5,5.1,21.1,4.4,-0.04],"group2_id":"Asian Ancestry","group2_values":[]}]' | target/release/wilcoxon

# Test example 1: cd .. && cargo build --release && time echo '[{"group1_id":"group1","group1_values":[22.3950723737944,33.8227081589866,45.1407992918976,28.3479649920482,18.2336819062475,4.32351183332503,11.9014307267498,48.0554144773632,14.9064014137257,11.2484716628678,42.857265946921,6.14226084970869,13.765204195166,23.7536687662359,35.0198161723092,30.1217778825667,1.55535256816074,38.5163993313909,34.6145691110287,8.42882150504738],"group2_id":"group2","group2_values":[35.3232058370486,38.4726115851663,63.7901770556346,63.6540996702388,54.1668611462228,86.2734804977663,87.4467799020931,71.2533111660741,90.7283631013706,36.3230113568716,33.9395571127534,92.234949907288,77.9833765677176,43.5002030362375,79.9727810896002,37.503333974164,39.9319424736314,33.0334767652676,47.5299863377586,80.9905858896673]}]' | target/release/wilcoxon

# Test example 2: cd .. && cargo build --release && time echo '[{"group1_id":"group1","group1_values":[0.73, 0.74, 0.8, 0.83, 0.88, 0.90, 1.04, 1.15],"group2_id":"group2","group2_values":[1.21, 1.38, 1.45, 1.46, 1.64, 1.89, 1.91]}]' | target/release/wilcoxon

# Test example 3: cd .. && cargo build --release && time echo '[{"group1_id":"group1","group1_values":[1.21, 1.38, 1.45, 1.46, 1.64, 1.89, 1.91],"group2_id":"group2","group2_values":[0.73, 0.74, 0.8, 0.83, 0.88, 0.90, 1.04, 1.15]}]' | target/release/wilcoxon

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

use itertools::Itertools;
use json;
use r_stats;
use serde::{Deserialize, Serialize};
use statrs::distribution::{ContinuousCDF, Normal};
use std::io;

#[derive(Debug, Serialize, Deserialize)]
struct OutputJson {
    // Output JSON data structure
    group1_id: String,
    group2_id: String,
    group1_values: Vec<f64>,
    group2_values: Vec<f64>,
    pvalue: Option<f64>,
}

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

                        if vec1.len() == 0 || vec2.len() == 0 {
                            // If one of the vectors has a length of zero, wilcoxon test is not performed and a pvalue of NULL is given.
                            output_string += &serde_json::to_string(&OutputJson {
                                group1_id: json_string[i]["group1_id"]
                                    .as_str()
                                    .unwrap()
                                    .to_string(),
                                group2_id: json_string[i]["group2_id"]
                                    .as_str()
                                    .unwrap()
                                    .to_string(),
                                group1_values: vec1,
                                group2_values: vec2,
                                pvalue: None,
                            })
                            .unwrap();
                            output_string += &",".to_string();
                        } else {
                            let mut pvalue: f64 = wilcoxon_rank_sum_test(
                                vec1.clone(),
                                vec2.clone(),
                                THRESHOLD,
                                't', // two-sided test
                            );

                            if pvalue > 0.01 {
                                pvalue = format!("{:.4}", pvalue).parse().unwrap();
                            }
                            //println!("p_value:{}", p_value);
                            output_string += &serde_json::to_string(&OutputJson {
                                group1_id: json_string[i]["group1_id"]
                                    .as_str()
                                    .unwrap()
                                    .to_string(),
                                group2_id: json_string[i]["group2_id"]
                                    .as_str()
                                    .unwrap()
                                    .to_string(),
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

fn wilcoxon_rank_sum_test(
    mut group1: Vec<f64>,
    mut group2: Vec<f64>,
    threshold: usize,
    alternative: char,
) -> f64 {
    // Check if there are any ties between the two groups

    let mut combined = group1.clone();
    combined.extend(group2.iter().cloned());
    combined.sort_by(|a, b| a.partial_cmp(b).unwrap());
    //println!("combined:{:?}", combined);

    group1.sort_by(|a, b| a.partial_cmp(b).unwrap());
    group2.sort_by(|a, b| a.partial_cmp(b).unwrap());
    //println!("group1:{:?}", group1);
    //println!("group2:{:?}", group2);

    let mut group1_iter = 0;
    let mut group2_iter = 0;
    let mut xy = Vec::<char>::new(); // Stores X-Y classification
    let mut ranks = Vec::<f64>::new(); // Stores the rank of each element
    let mut is_repeat = false;
    let mut frac_rank: f64 = 0.0;
    let mut num_repeats: f64 = 1.0;
    let low_cutoff: usize = 6; // When both vectors are below this cutoff, exact p-value will be computed by iterating through all possible combinations. This is helpful especially in case of ties.
    let mut repeat_iter: f64 = 1.0;
    #[allow(unused_variables)]
    let mut weight_x: f64 = 0.0;
    let mut weight_y: f64 = 0.0;
    let mut group_char: char = 'X';
    for i in 0..combined.len() {
        //println!("group1_iter:{}", group1_iter);
        //println!("group2_iter:{}", group2_iter);
        //println!("item1:{}", combined[i]);
        //println!("is_repeat:{}", is_repeat);
        if group1_iter < group1.len() && combined[i] == group1[group1_iter] {
            xy.push('X');
            group1_iter += 1;
            group_char = 'X';
        } else if group2_iter < group2.len() && combined[i] == group2[group2_iter] {
            xy.push('Y');
            group2_iter += 1;
            group_char = 'Y';
        }

        // Computing ranks
        if is_repeat == false {
            // Check if current element has other occurences
            num_repeats = 1.0;
            for j in i + 1..combined.len() {
                if combined[i] == combined[j] {
                    is_repeat = true;
                    repeat_iter = 1.0;
                    num_repeats += 1.0;
                } else {
                    break;
                }
            }
            //println!("num_repeats:{}", num_repeats);
            if is_repeat == false {
                ranks.push(i as f64 + 1.0);
                if group_char == 'X' {
                    weight_x += i as f64 + 1.0;
                } else if group_char == 'Y' {
                    weight_y += i as f64 + 1.0;
                }
            } else {
                frac_rank = i as f64 + 1.0 + 1.0 / num_repeats;
                ranks.push(frac_rank);
                if group_char == 'X' {
                    weight_x += frac_rank;
                } else if group_char == 'Y' {
                    weight_y += frac_rank
                }
            }
        } else if repeat_iter < num_repeats {
            // Repeat case
            ranks.push(frac_rank);
            repeat_iter += 1.0;
            if group_char == 'X' {
                weight_x += frac_rank;
            } else if group_char == 'Y' {
                weight_y += frac_rank
            }
            if repeat_iter == num_repeats {
                is_repeat = false;
            }
        } else {
            //println!("i:{}", i);
            ranks.push(i as f64 + 1.0);
            repeat_iter = 1.0;
            num_repeats = 1.0;
            if group_char == 'X' {
                weight_x += i as f64 + 1.0;
            } else if group_char == 'Y' {
                weight_y += i as f64 + 1.0;
            }
        }
    }
    //println!("xy:{:?}", xy);
    //println!("ranks:{:?}", ranks);
    //println!("weight_x:{}", weight_x);
    //println!("weight_y:{}", weight_y);

    //u_dash (calculated below) calculates the "W Statistic" in wilcox.test function in R

    let u_y = weight_y - (group2.len() as f64 * (group2.len() as f64 + 1.0) / 2.0) as f64;
    let u_dash_y = (u_y - (group1.len() * group2.len()) as f64).abs();
    //println!("u_dash_y:{}", u_dash_y);

    let u_x = weight_x - (group1.len() as f64 * (group1.len() as f64 + 1.0) / 2.0) as f64;
    let u_dash_x = (u_x - (group1.len() * group2.len()) as f64).abs();
    //println!("u_dash_x:{}", u_dash_x);

    // Calculate test_statistic

    //let t1 = weight_x - ((group1.len() as f64) * (group1.len() as f64 + 1.0)) / 2.0;
    //let t2 = weight_y - ((group2.len() as f64) * (group2.len() as f64 + 1.0)) / 2.0;
    //
    //let mut test_statistic = t1;
    //if t2 < t1 {
    //    test_statistic = t2;
    //}

    //println!("test_statistic:{}", test_statistic);

    if group1.len() <= threshold || group2.len() < threshold
    // In principle in case of ties (repeats), iterating through all possible combinations will give an exact p-value but is very slow, so this will be true only when both vectors have lengths lower than low_cutoff
    {
        // Compute exact p-values

        // Calculate conditional probability for weight_y

        if alternative == 'g' {
            // Alternative "greater"
            if group1.len() <= low_cutoff && group2.len() <= low_cutoff {
                iterate_exact_p_values(ranks, weight_y, group2.len())
            } else {
                calculate_exact_probability_using_combinations(u_dash_y, group1.len(), group2.len())
            }
        } else if alternative == 'l' {
            // Alternative "lesser"
            if group1.len() <= low_cutoff && group2.len() <= low_cutoff {
                iterate_exact_p_values(ranks, weight_x, group1.len())
            } else {
                calculate_exact_probability_using_combinations(u_dash_x, group1.len(), group2.len())
            }
        } else {
            // Two-sided distribution
            let p_less_g;
            let p_less_l;

            if group1.len() <= low_cutoff && group2.len() <= low_cutoff {
                p_less_g = iterate_exact_p_values(ranks.clone(), weight_y, group2.len());
                p_less_l = iterate_exact_p_values(ranks, weight_x, group1.len());
            } else {
                p_less_g = calculate_exact_probability_using_combinations(
                    u_dash_y,
                    group1.len(),
                    group2.len(),
                );
                p_less_l = calculate_exact_probability_using_combinations(
                    u_dash_x,
                    group1.len(),
                    group2.len(),
                );
            }

            let mut p_value;
            if p_less_g < p_less_l {
                p_value = 2.0 * p_less_g; // Multiplied by 2 to account for two-sided p-value
            } else {
                p_value = 2.0 * p_less_l // Multiplied by 2 to account for two-sided p-value
            }
            if p_value > 1.0 {
                p_value = 1.0;
            }
            p_value
        }
    } else {
        // Compute p-values from a normal distribution
        let expected_w = (group2.len() as f64 * (group1.len() + group2.len() + 1) as f64) / 2.0;
        let variance_w =
            (group2.len() as f64 * group1.len() as f64 * (group1.len() + group2.len() + 1) as f64)
                / 12.0;
        //let w_starred = (weight_y - expected_w) / variance_w.sqrt();
        let n = Normal::new(expected_w, variance_w.sqrt()).unwrap();
        //println!("n:{:?}", n);
        //println!("w_starred:{}", w_starred);
        //normal_distribution(w_starred)

        if alternative == 'g' {
            // Alternative "greater"
            //println!("greater:{}", n.cdf(weight_y));
            n.cdf(weight_y)
        } else if alternative == 'l' {
            // Alternative "lesser"
            //println!("lesser:{}", n.cdf(weight_x));
            n.cdf(weight_x)
        } else {
            // Alternative "two-sided"
            let p_g = n.cdf(weight_y);
            //println!("greater:{}", p_g);
            let p_l = n.cdf(weight_x);
            //println!("lesser:{}", p_l);
            let mut p_value;
            if p_g < p_l {
                p_value = 2.0 * p_g; // Multiplied by 2 to account for two-sided p-value
            } else {
                p_value = 2.0 * p_l; // Multiplied by 2 to account for two-sided p-value
            }
            //println!("p_value:{}", p_value);
            if p_value > 1.0 {
                p_value = 1.0;
            }
            p_value
        }
    }
}

// To be used only when there are no ties in the input data
fn calculate_exact_probability_using_combinations(weight: f64, x: usize, y: usize) -> f64 {
    //println!("Using Wilcoxon CDF");
    let p_value = r_stats::wilcox_cdf(weight, x as f64, y as f64, true, false);
    //println!("p_value:{}", p_value);
    p_value
}

// Calculates exact p-values by iterating over all possible combinations of weights
fn iterate_exact_p_values(ranks: Vec<f64>, weight: f64, y_length: usize) -> f64 {
    let mut combinations = ranks.into_iter().combinations(y_length);
    let mut combination = combinations.next();
    let mut num_combinations = 0;
    let mut w_less = 0;
    while combination != None {
        //println!("combination:{:?}", combination);
        //println!("combination_sum:{:?}", combination.into_iter().sum::<f64>());
        //w_distribution.push(combination.unwrap().into_iter().sum::<f64>());
        if combination.unwrap().into_iter().sum::<f64>() <= weight {
            w_less += 1;
        }
        num_combinations += 1;
        combination = combinations.next();
    }
    //println!("w_distribution:{:?}", w_distribution);
    //println!("num_combinations:{}", num_combinations);
    //println!("w_less:{:?}", w_less);
    //println!(
    //    "p_value greater:{}",
    //    w_less as f64 / num_combinations as f64
    //);
    w_less as f64 / num_combinations as f64
}
