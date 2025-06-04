#![allow(non_snake_case)]
use fishers_exact::fishers_exact;
//use r_mathlib;
use r_mathlib::chi_squared_cdf;
use statrs::distribution::{ChiSquared, ContinuousCDF};
use std::collections::HashSet;
use std::panic;

#[allow(dead_code)]
pub fn strand_analysis_one_iteration(
    // Runs fisher's exact test or Chisquare test
    alternate_forward_count: u32, //for Fisher/Chi test, represents R1C1 in 2X2 contingency table
    alternate_reverse_count: u32, //for Fisher/Chi test, represents R2C1 in 2X2 contingency table
    reference_forward_count: u32, //for Fisher/Chi test, represents R1C2 in 2X2 contingency table
    reference_reverse_count: u32, //for Fisher/Chi test, represents R2C2 in 2X2 contingency table
    fisher_chisq_test: u64, // This option is useful in the event this function has been run previously, we can ask to run the spcific test only rather than having to try out both tests each time. This decreases execution time. 0 = first time (both tests will be tried), 1 = fisher test, 2 = chi-sq test
) -> (f64, u64) {
    let mut p_value: f64 = 0.0;
    let mut fisher_chisq_test_final: u64 = 0;

    if fisher_chisq_test == 0 {
        let p_value_result = panic::catch_unwind(|| {
            let p_value = fishers_exact(&[
                alternate_forward_count,
                alternate_reverse_count,
                reference_forward_count,
                reference_reverse_count,
            ])
            .unwrap()
            .two_tail_pvalue;
            p_value
        });

        match p_value_result {
            Ok(res) => {
                //println!("Fisher test worked:{:?}", p_value_result);
                p_value = res;
                fisher_chisq_test_final = 1;
            }
            Err(_) => {
                //println!("Fisher test failed, using Chi-sq test instead");
                p_value = chi_square_test(
                    alternate_forward_count,
                    alternate_reverse_count,
                    reference_forward_count,
                    reference_reverse_count,
                );
                fisher_chisq_test_final = 2;
            }
        }
    } else if fisher_chisq_test == 1 {
        let p_value_result = panic::catch_unwind(|| {
            let p_value = fishers_exact(&[
                alternate_forward_count,
                alternate_reverse_count,
                reference_forward_count,
                reference_reverse_count,
            ])
            .unwrap()
            .two_tail_pvalue;
            p_value
        });

        match p_value_result {
            Ok(res) => {
                //println!("Fisher test worked:{:?}", p_value_result);
                p_value = res;
            }
            Err(_) => {
                //println!("Fisher test failed, using Chi-sq test instead");
                p_value = chi_square_test(
                    alternate_forward_count,
                    alternate_reverse_count,
                    reference_forward_count,
                    reference_reverse_count,
                );
            }
        }
        fisher_chisq_test_final = 1;
    } else if fisher_chisq_test == 2 {
        p_value = chi_square_test(
            alternate_forward_count,
            alternate_reverse_count,
            reference_forward_count,
            reference_reverse_count,
        );
        fisher_chisq_test_final = 2;
    }

    (p_value, fisher_chisq_test_final)
}

#[allow(dead_code)]
fn chi_square_test(
    alternate_forward_count: u32,
    alternate_reverse_count: u32,
    reference_forward_count: u32,
    reference_reverse_count: u32,
) -> f64 {
    if (alternate_reverse_count == 0 && reference_reverse_count == 0)
        || (alternate_forward_count == 0 && reference_forward_count == 0)
    {
        0.05 // Arbitarily put a very high number when there are only forward or reverse reads for alternate/reference
    } else {
        let total: f64 =
            (alternate_forward_count + alternate_reverse_count + reference_forward_count + reference_reverse_count)
                as f64;
        let expected_alternate_forward_count: f64 = (alternate_forward_count + alternate_reverse_count) as f64
            * (alternate_forward_count + reference_forward_count) as f64
            / total;
        let expected_alternate_reverse_count: f64 = (alternate_forward_count + alternate_reverse_count) as f64
            * (alternate_reverse_count + reference_reverse_count) as f64
            / total;
        let expected_reference_forward_count: f64 = (alternate_forward_count + reference_forward_count) as f64
            * (reference_forward_count + reference_reverse_count) as f64
            / total;
        let expected_reference_reverse_count: f64 = (reference_forward_count + reference_reverse_count) as f64
            * (alternate_reverse_count + reference_reverse_count) as f64
            / total;

        let chi_sq: f64 = ((alternate_forward_count as f64 - expected_alternate_forward_count)
            * (alternate_forward_count as f64 - expected_alternate_forward_count))
            / expected_alternate_forward_count
            + ((reference_forward_count as f64 - expected_reference_forward_count)
                * (reference_forward_count as f64 - expected_reference_forward_count))
                / expected_reference_forward_count
            + ((alternate_reverse_count as f64 - expected_alternate_reverse_count)
                * (alternate_reverse_count as f64 - expected_alternate_reverse_count))
                / expected_alternate_reverse_count
            + ((reference_reverse_count as f64 - expected_reference_reverse_count)
                * (reference_reverse_count as f64 - expected_reference_reverse_count))
                / expected_reference_reverse_count;

        //println!("chi_sq:{}", chi_sq);
        let chi_sq_dist = ChiSquared::new(1.0).unwrap(); // Using degrees of freedom = 1
        let p_value: f64 = 1.0 - chi_sq_dist.cdf(chi_sq);
        //println!("p-value:{}", p_value);
        p_value
    }
}

#[allow(dead_code)]
pub fn wilcoxon_rank_sum_test(
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
    let mut xy: Vec<char> = Vec::with_capacity(combined.len()); // Stores X-Y classification
    let mut ranks: Vec<f64> = Vec::with_capacity(combined.len()); // Stores the rank of each element
    let mut is_repeat = false;
    let mut repeat_present = false;
    let mut frac_rank: f64 = 0.0;
    let mut num_repeats: f64 = 1.0;
    let mut repeat_iter: f64 = 1.0;
    #[allow(unused_variables)]
    let mut weight_x: f64 = 0.0;
    let mut weight_y: f64 = 0.0;
    let mut group_char: char = 'X';
    let mut rank_frequencies: Vec<f64> = Vec::with_capacity(combined.len());
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
            nties_sum += rank_frequencies[i] * rank_frequencies[i] * rank_frequencies[i] - rank_frequencies[i];
        }

        let sigma = (((group1.len() * group2.len()) as f64) / 12.0
            * ((group1.len() + group2.len() + 1) as f64
                - nties_sum / (((group1.len() + group2.len()) as f64) * ((group1.len() + group2.len() - 1) as f64))))
            .sqrt();
        //println!("sigma:{}", sigma);
        let mut correction: f64 = 0.0;
        if correct == true {
            if alternative == 'g' {
                // Alternative "greater"
                correction = 0.5;
            } else if alternative == 'l' {
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
        if alternative == 'g' {
            // Alternative "greater"
            //println!("greater:{}", n.cdf(weight_y));
            //1.0 - n.cdf(z) // Applying continuity correction
            r_mathlib::normal_cdf(z, 0.0, 1.0, false, false)
        } else if alternative == 'l' {
            // Alternative "lesser"
            //println!("lesser:{}", n.cdf(weight_x));
            //n.cdf(z) // Applying continuity coorection
            r_mathlib::normal_cdf(z, 0.0, 1.0, true, false)
        } else {
            // Alternative "two-sided"
            let p_g = r_mathlib::normal_cdf(z, 0.0, 1.0, false, false); // Applying continuity correction
            let p_l = r_mathlib::normal_cdf(z, 0.0, 1.0, true, false); // Applying continuity correction
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
#[allow(dead_code)]
fn calculate_exact_probability(weight: f64, x: usize, y: usize, alternative: char) -> f64 {
    //println!("Using Wilcoxon CDF");
    let mut p_value;
    if alternative == 't' {
        if weight > ((x * y) as f64) / 2.0 {
            p_value = 2.0 * r_mathlib::wilcox_cdf(weight - 1.0, x as f64, y as f64, false, false);
        } else {
            p_value = 2.0 * r_mathlib::wilcox_cdf(weight, x as f64, y as f64, true, false);
        }
        if p_value > 1.0 {
            p_value = 1.0;
        }
    } else if alternative == 'g' {
        p_value = r_mathlib::wilcox_cdf(weight - 1.0, x as f64, y as f64, false, false);
    } else if alternative == 'l' {
        p_value = r_mathlib::wilcox_cdf(weight, x as f64, y as f64, true, false);
    } else {
        // Should not happen
        panic!("Unknown alternative option given, please check!");
    }
    //println!("p_value:{}", p_value);
    p_value
}

#[allow(dead_code)]
pub fn calculate_frac_rank(current_rank: f64, num_repeats: f64) -> f64 {
    let mut sum = 0.0;
    for i in 0..num_repeats as usize {
        let rank = current_rank + i as f64;
        sum += rank;
    }
    sum / num_repeats
}

#[allow(non_camel_case_types)]
#[allow(non_snake_case)]
#[derive(Debug, Clone, PartialEq, PartialOrd)]
pub struct gene_order {
    pub gene_name: String,
    pub fold_change: f32,
    pub rank: Option<usize>,
}

#[allow(dead_code)]
pub fn cerno(
    genes_descending: &Vec<gene_order>,
    genes_ascending: &Vec<gene_order>,
    genes_in_pathway: HashSet<String>,
) -> (f32, f32, f32, f32, String, f32) {
    // Ensure sample_coding_genes is sorted in decreasing order of fold_change
    // Filter the genes_descending vector to only include those whose gene_names are in the HashSet genes_in_pathway
    let gene_intersections_descending: Vec<&gene_order> = genes_descending
        .iter()
        .filter(|genes_descending| genes_in_pathway.contains(&genes_descending.gene_name)) // Check if name is in the HashSet genes_in_pathway
        .collect(); // Collect the results into a new vector

    let N1 = gene_intersections_descending.len() as f32;
    let N = genes_descending.len() as f32;
    let mut gene_set_hits: String = "".to_string();
    for gene in &gene_intersections_descending {
        gene_set_hits += &(gene.gene_name.to_string() + &",");
    }
    if gene_intersections_descending.len() > 0 {
        // Remove the last "," in string
        gene_set_hits.pop();
    }

    let ranks_descending: Vec<usize> = gene_intersections_descending // x <- l %in% mset$gs2gv[[m]] ; ranks <- c(1:N)[x]
        .iter()
        .map(|x| x.rank.unwrap())
        .collect::<Vec<usize>>();

    let cerno: f32 = ranks_descending // -2 * sum( log(ranks/N) )
        .iter()
        .map(|x| ((*x as f32) / N).ln())
        .collect::<Vec<f32>>()
        .iter()
        .sum::<f32>()
        * (-2.0);

    let cES;
    let N2 = N - N1; // N2 = N - N1
    let R1 = ranks_descending.iter().sum::<usize>() as f32; // R1 <- sum(ranks)
    let U = N1 * N2 + N1 * (N1 + 1.0) / 2.0 - R1; // U  <- N1*N2+N1*(N1+1)/2-R1
    let AUC = U / (N1 * N2); // AUC <- U/(N1*N2)
    let p_value;
    if AUC >= 0.5 {
        // Upregulated geneset
        cES = cerno / (2.0 * (N1 as f32)); // cES <- cerno/(2*N1)
        p_value = chi_squared_cdf(cerno as f64, (2.0 * N1) as f64, false, false);
    // pchisq(ret$cerno, 2*N1, lower.tail=FALSE)
    } else {
        let gene_intersections_ascending: Vec<&gene_order> = genes_ascending
            .iter()
            .filter(|genes_ascending| genes_in_pathway.contains(&genes_ascending.gene_name)) // Check if name is in the HashSet genes_in_pathway
            .collect(); // Collect the results into a new vector
        let ranks_ascending: Vec<usize> = gene_intersections_ascending // x <- l %in% mset$gs2gv[[m]] ; ranks <- c(1:N)[x]
            .iter()
            .map(|x| x.rank.unwrap())
            .collect::<Vec<usize>>();
        let cerno_ascending: f32 = ranks_ascending // -2 * sum( log(ranks/N) )
            .iter()
            .map(|x| ((*x as f32) / N).ln())
            .collect::<Vec<f32>>()
            .iter()
            .sum::<f32>()
            * (-2.0);
        cES = cerno_ascending / (2.0 * (N1 as f32)); // cES <- cerno/(2*N1)
        p_value = chi_squared_cdf(cerno_ascending as f64, (2.0 * N1) as f64, false, false);
    }
    (p_value as f32, AUC, cES, N1, gene_set_hits, cerno)
}
