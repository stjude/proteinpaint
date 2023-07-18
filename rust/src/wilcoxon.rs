// Syntax: cd .. && cargo build --release && echo '{"European Ancestry, African Ancestry":{"group1values":[3.7,2.5,5.9,13.1,1,10.6,3.2,3,6.5,15.5,2.6,16.5,2.6,4,8.6,8.3,1.9,7.9,7.9,6.1,17.6,3.1,3,1.5,8.1,18.2,-1.8,3.6,6,1.9,8.9,3.2,0.3,-1,11.2,6.2,16.2,7.5,9,9.4,18.9,0.1,11.5,10.1,12.5,14.6,1.5,17.3,15.4,7.6,2.4,13.5,3.8,17],"group2values":[11.5,5.1,21.1,4.4,-0.04]},"European Ancestry, Asian Ancestry":{"group1values":[3.7,2.5,5.9,13.1,1,10.6,3.2,3,6.5,15.5,2.6,16.5,2.6,4,8.6,8.3,1.9,7.9,7.9,6.1,17.6,3.1,3,1.5,8.1,18.2,-1.8,3.6,6,1.9,8.9,3.2,0.3,-1,11.2,6.2,16.2,7.5,9,9.4,18.9,0.1,11.5,10.1,12.5,14.6,1.5,17.3,15.4,7.6,2.4,13.5,3.8,17],"group2values":[1.7]},"African Ancestry, Asian Ancestry":{"group1values":[11.5,5.1,21.1,4.4,-0.04],"group2values":[1.7]}}' | target/release/wilcoxon

use json::JsonValue;
//use serde::{Deserialize, Serialize};
//use serde_json::Value;
use itertools::Itertools;
use statrs::distribution::{ContinuousCDF, Normal};
use std::io;

fn main() {
    let mut input = String::new();
    match io::stdin().read_line(&mut input) {
        // Accepting the piped input from nodejs (or command line from testing)
        Ok(_n) => {
            //println!("{} bytes read", n);
            //println!("input:{}", input);
            const THRESHOLD: usize = 50;
            let input_json = json::parse(&input);
            match input_json {
                Ok(json_string) => {
                    //println!("{} bytes read", n);
                    println!("json_string:{}", json_string);
                    println!("{}", json_string.is_object());
                    for item in json_string.entries() {
                        let mut vec1 = Vec::<f64>::new();
                        let mut vec2 = Vec::<f64>::new();
                        println!("key:{}", item.0);
                        let mut iter = 0;
                        for array in item.1.entries() {
                            if iter == 0 {
                                for arr_item in array.1.members() {
                                    vec1.push(arr_item.as_f64().unwrap());
                                }
                            } else if iter == 1 {
                                for arr_item in array.1.members() {
                                    vec2.push(arr_item.as_f64().unwrap());
                                }
                            }
                            iter += 1;
                        }
                        println!("vec1:{:?}", vec1);
                        println!("vec2:{:?}", vec2);
                        let p_value = wilcoxon_rank_sum_test(
                            vec1, vec2, THRESHOLD, 't', // two-sided test
                        );
                        println!("p_value:{}", p_value);
                    }
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

    let mut group1_iter = 0;
    let mut group2_iter = 0;
    let mut xy = Vec::<char>::new(); // Stores X-Y classification
    let mut ranks = Vec::<f64>::new(); // Stores the rank of each element
    let mut is_repeat = false;
    let mut frac_rank: f64 = 0.0;
    let mut num_repeats: f64 = 1.0;
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

    // u_dash (calculated below) calculates the "W Statistic" in wilcox.test function in R

    //let u = weight_y - (group2.len() as f64 * (group2.len() as f64 + 1.0) / 2.0) as f64;
    //let u_dash = (u - (group1.len() * group2.len()) as f64).abs();
    //println!("u_dash:{}", u_dash);

    // Calculate test_statistic

    //let t1 = weight_x - ((group1.len() as f64) * (group1.len() as f64 + 1.0)) / 2.0;
    //let t2 = weight_y - ((group2.len() as f64) * (group2.len() as f64 + 1.0)) / 2.0;
    //
    //let mut test_statistic = t1;
    //if t2 < t1 {
    //    test_statistic = t2;
    //}

    //println!("test_statistic:{}", test_statistic);

    if combined.len() <= threshold {
        // Compute exact p-values

        // Calculate conditional probability for weight_y

        if alternative == 'g' {
            // Alternative "greater"
            let mut combinations = ranks.into_iter().combinations(group2.len());
            let mut w_distribution = Vec::<f64>::new();
            let mut combination = combinations.next();
            let mut num_combinations = 0;
            while combination != None {
                //println!("combination:{:?}", combination);
                //println!("combination_sum:{:?}", combination.into_iter().sum::<f64>());
                w_distribution.push(combination.unwrap().into_iter().sum::<f64>());
                num_combinations += 1;
                combination = combinations.next();
            }
            //println!("w_distribution:{:?}", w_distribution);
            //println!("num_combinations:{}", num_combinations);

            let mut w_less = 0;
            for item in &w_distribution {
                if item <= &weight_y {
                    w_less += 1;
                }
            }
            //println!("w_less:{:?}", w_less);
            //println!(
            //    "p_value greater:{}",
            //    w_less as f64 / num_combinations as f64
            //);
            w_less as f64 / num_combinations as f64
        } else if alternative == 'l' {
            let mut combinations = ranks.into_iter().combinations(group1.len());
            let mut w_distribution = Vec::<f64>::new();
            let mut combination = combinations.next();
            let mut num_combinations = 0;
            while combination != None {
                //println!("combination:{:?}", combination);
                //println!("combination_sum:{:?}", combination.into_iter().sum::<f64>());
                w_distribution.push(combination.unwrap().into_iter().sum::<f64>());
                num_combinations += 1;
                combination = combinations.next();
            }
            //println!("w_distribution:{:?}", w_distribution);
            //println!("num_combinations:{}", num_combinations);

            // Alternative "lesser"
            let mut w_less = 0;
            for item in &w_distribution {
                if item <= &weight_x {
                    w_less += 1;
                }
            }
            //println!("w_less:{:?}", w_less);
            //println!("p_value lesser:{}", w_less as f64 / num_combinations as f64);
            w_less as f64 / num_combinations as f64
        } else {
            let mut combinations_g = ranks.clone().into_iter().combinations(group2.len());
            let mut w_distribution_g = Vec::<f64>::new();
            let mut combination_g = combinations_g.next();
            let mut num_combinations = 0;
            while combination_g != None {
                //println!("combination:{:?}", combination);
                //println!("combination_sum:{:?}", combination.into_iter().sum::<f64>());
                w_distribution_g.push(combination_g.unwrap().into_iter().sum::<f64>());
                num_combinations += 1;
                combination_g = combinations_g.next();
            }
            //println!("w_distribution_g:{:?}", w_distribution_g);
            //println!("num_combinations_g:{}", num_combinations_g);

            // Alternative "two sided"
            let mut w_less_g = 0;
            for item in &w_distribution_g {
                if item <= &weight_y {
                    w_less_g += 1;
                }
            }
            //println!("w_less_g:{:?}", w_less_g);
            //println!(
            //    "p_value greater:{}",
            //    w_less_g as f64 / num_combinations as f64
            //);
            let p_less_g = w_less_g as f64 / num_combinations as f64;

            let mut combinations_l = ranks.into_iter().combinations(group1.len());
            let mut w_distribution_l = Vec::<f64>::new();
            let mut combination_l = combinations_l.next();
            let mut num_combinations = 0;
            while combination_l != None {
                //println!("combination:{:?}", combination);
                //println!("combination_sum:{:?}", combination.into_iter().sum::<f64>());
                w_distribution_l.push(combination_l.unwrap().into_iter().sum::<f64>());
                num_combinations += 1;
                combination_l = combinations_l.next();
            }
            //println!("w_distribution_l:{:?}", w_distribution_l);
            //println!("num_combinations_l:{}", num_combinations_l);

            let mut w_less_l = 0;
            for item in &w_distribution_l {
                if item <= &weight_x {
                    w_less_l += 1;
                }
            }
            //println!("w_less_l:{:?}", w_less_l);
            //println!(
            //    "p_value lesser:{}",
            //    w_less_l as f64 / num_combinations as f64
            //);
            let p_less_l = w_less_l as f64 / num_combinations as f64;

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
        //println!("w_starred:{}", w_starred);
        //normal_distribution(w_starred)

        if alternative == 'g' {
            // Alternative "greater"
            n.cdf(weight_y)
        } else if alternative == 'l' {
            // Alternative "lesser"
            n.cdf(weight_x)
        } else {
            // Alternative "two-sided"
            let p_g = n.cdf(weight_y);
            let p_l = n.cdf(weight_x);
            let mut p_value;
            if p_g < p_l {
                p_value = 2.0 * p_g; // Multiplied by 2 to account for two-sided p-value
            } else {
                p_value = 2.0 * p_l; // Multiplied by 2 to account for two-sided p-value
            }
            if p_value > 1.0 {
                p_value = 1.0;
            }
            p_value
        }
    }
}
