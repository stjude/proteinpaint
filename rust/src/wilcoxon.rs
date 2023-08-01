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

# Test example 1: cd .. && cargo build --release && time echo '[{"group1_id":"group1","group1_values":[22.3950723737944,33.8227081589866,45.1407992918976,28.3479649920482,18.2336819062475,4.32351183332503,11.9014307267498,48.0554144773632,14.9064014137257,11.2484716628678,42.857265946921,6.14226084970869,13.765204195166,23.7536687662359,35.0198161723092,30.1217778825667,1.55535256816074,38.5163993313909,34.6145691110287,8.42882150504738],"group2_id":"group2","group2_values":[35.3232058370486,38.4726115851663,63.7901770556346,63.6540996702388,54.1668611462228,86.2734804977663,87.4467799020931,71.2533111660741,90.7283631013706,36.3230113568716,33.9395571127534,92.234949907288,77.9833765677176,43.5002030362375,79.9727810896002,37.503333974164,39.9319424736314,33.0334767652676,47.5299863377586,80.9905858896673]}]' | target/release/wilcoxon

# Test example 2: cd .. && cargo build --release && time echo '[{"group1_id":"group1","group1_values":[165.0, 166.7, 172.2, 176.9],"group2_id":"group2","group2_values":[153.1, 156.0, 158.6, 176.4]}]' | target/release/wilcoxon

# Test example 3: cd .. && cargo build --release && time echo '[{"group1_id":"group1","group1_values":[1.21, 1.38, 1.45, 1.46, 1.64, 1.89, 1.91],"group2_id":"group2","group2_values":[0.73, 0.74, 0.8, 0.83, 0.88, 0.90, 1.04, 1.15]}]' | target/release/wilcoxon

# Test example 4: cd .. && cargo build --release && time cat ~/sjpp/test.txt | target/release/wilcoxon

# Test example 5: cd .. && cargo build --release && time echo '[{"group1_id":"group1","group1_values":[117.1, 121.3, 127.8, 121.9, 117.4, 124.5, 119.5, 115.1],"group2_id":"group2","group2_values":[123.5, 125.3, 126.5, 127.9, 122.1, 125.6, 129.8, 117.2]}]' | target/release/wilcoxon

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
use r_stats;
use serde::{Deserialize, Serialize};
use statrs::distribution::{ContinuousCDF, Normal};
use std::io;

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
                                true,
                            );

                            if pvalue > 0.01 {
                                pvalue = format!("{:.4}", pvalue).parse().unwrap();
                            }
                            //println!("pvalue:{}", pvalue);
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
    correct: bool,
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
    let mut repeat_present = false;
    let mut frac_rank: f64 = 0.0;
    let mut num_repeats: f64 = 1.0;
    let mut repeat_iter: f64 = 1.0;
    #[allow(unused_variables)]
    let mut weight_x: f64 = 0.0;
    let mut weight_y: f64 = 0.0;
    let mut group_char: char = 'X';
    let mut rank_frequencies = Vec::<f64>::new();
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
                    repeat_present = true;
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
                //rank_frequencies.push(RankFreq {
                //    rank: i as f64 + 1.0,
                //    freq: 1,
                //});
                rank_frequencies.push(1.0);
            } else {
                frac_rank = calculate_frac_rank(i as f64 + 1.0, num_repeats);
                ranks.push(frac_rank);
                if group_char == 'X' {
                    weight_x += frac_rank;
                } else if group_char == 'Y' {
                    weight_y += frac_rank
                }
                //rank_frequencies.push(RankFreq {
                //    rank: frac_rank,
                //    freq: num_repeats as usize,
                //});
                rank_frequencies.push(num_repeats);
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
    //println!("rank_frequencies:{:?}", rank_frequencies);
    //println!("xy:{:?}", xy);
    //println!("ranks:{:?}", ranks);
    //println!("weight_x:{}", weight_x);
    //println!("weight_y:{}", weight_y);

    //u_dash (calculated below) calculates the "W Statistic" in wilcox.test function in R

    let u_y = weight_y - (group2.len() as f64 * (group2.len() as f64 + 1.0) / 2.0) as f64;
    let u_dash_y = (u_y - (group1.len() * group2.len()) as f64).abs();
    //println!("u_dash_y:{}", u_dash_y);

    let u_x = weight_x - (group1.len() as f64 * (group1.len() as f64 + 1.0) / 2.0) as f64;
    let _u_dash_x = (u_x - (group1.len() * group2.len()) as f64).abs();
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

    if group1.len() < threshold && group2.len() < threshold && repeat_present == false {
        // Compute exact p-values

        // Calculate conditional probability for weight_y

        if alternative == 'g' {
            // Alternative "greater"
            //if group1.len() <= low_cutoff && group2.len() <= low_cutoff {
            //    iterate_exact_p_values(ranks, weight_y, group2.len())
            //} else {
            calculate_exact_probability(u_dash_y, group1.len(), group2.len(), alternative)
            //}
        } else if alternative == 'l' {
            // Alternative "lesser"
            //if group1.len() <= low_cutoff && group2.len() <= low_cutoff {
            //    iterate_exact_p_values(ranks, weight_x, group1.len())
            //} else {
            calculate_exact_probability(u_dash_y, group1.len(), group2.len(), alternative)
            //}
        } else {
            // Two-sided distribution
            calculate_exact_probability(u_dash_y, group1.len(), group2.len(), alternative)
        }
    } else {
        // Compute p-values from a normal distribution
        //println!("group1 length:{}", group1.len());
        //println!("group2 length:{}", group2.len());

        let mut z = u_dash_y - ((group1.len() * group2.len()) as f64) / 2.0;
        //println!("z_original:{}", z);
        let mut nties_sum: f64 = 0.0;
        for i in 0..rank_frequencies.len() {
            nties_sum += rank_frequencies[i] * rank_frequencies[i] * rank_frequencies[i]
                - rank_frequencies[i];
        }

        let sigma = (((group1.len() * group2.len()) as f64) / 12.0
            * ((group1.len() + group2.len() + 1) as f64
                - nties_sum
                    / (((group1.len() + group2.len()) as f64)
                        * ((group1.len() + group2.len() - 1) as f64))))
            .sqrt();
        //println!("sigma:{}", sigma);
        let mut correction: f64 = 0.0;
        if correct == true {
            if alternative == 'g' {
                // Alternative "greater"
                correction = 0.5;
            } else if alternative == 'g' {
                // Alternative "lesser"
                correction = -0.5;
            } else {
                // Alternative "two-sided"
                if z > 0.0 {
                    correction = 0.5;
                } else if z < 0.0 {
                    correction = -0.5;
                } else {
                    // z=0
                    correction = 0.0;
                }
            }
        }
        z = (z - correction) / sigma;
        //println!("z:{}", z);
        let n = Normal::new(0.0, 1.0).unwrap();
        if alternative == 'g' {
            // Alternative "greater"
            //println!("greater:{}", n.cdf(weight_y));
            1.0 - n.cdf(z) // Applying continuity coorection
        } else if alternative == 'l' {
            // Alternative "lesser"
            //println!("lesser:{}", n.cdf(weight_x));
            n.cdf(z) // Applying continuity coorection
        } else {
            // Alternative "two-sided"
            let p_g = 1.0 - n.cdf(z); // Applying continuity coorection
            let p_l = n.cdf(z); // Applying continuity coorection
            let mut p_value;
            if p_g < p_l {
                p_value = 2.0 * p_g;
            } else {
                p_value = 2.0 * p_l;
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
fn calculate_exact_probability(weight: f64, x: usize, y: usize, alternative: char) -> f64 {
    //println!("Using Wilcoxon CDF");
    let mut p_value;
    if alternative == 't' {
        if weight > ((x * y) as f64) / 2.0 {
            p_value = 2.0 * r_stats::wilcox_cdf(weight - 1.0, x as f64, y as f64, false, false);
        } else {
            p_value = 2.0 * r_stats::wilcox_cdf(weight, x as f64, y as f64, true, false);
        }
        if p_value > 1.0 {
            p_value = 1.0;
        }
    } else if alternative == 'g' {
        p_value = r_stats::wilcox_cdf(weight - 1.0, x as f64, y as f64, false, false);
    } else if alternative == 'l' {
        p_value = r_stats::wilcox_cdf(weight, x as f64, y as f64, true, false);
    } else {
        // Should not happen
        panic!("Unknown alternative option given, please check!");
    }
    //println!("p_value:{}", p_value);
    p_value
}

fn calculate_frac_rank(current_rank: f64, num_repeats: f64) -> f64 {
    let mut sum = 0.0;
    for i in 0..num_repeats as usize {
        let rank = current_rank + i as f64;
        sum += rank;
    }

    sum / num_repeats
}
