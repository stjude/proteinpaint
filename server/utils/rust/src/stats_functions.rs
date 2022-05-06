use fishers_exact::fishers_exact;
use statrs::distribution::{ChiSquared, ContinuousCDF};
use std::panic;

pub fn strand_analysis_one_iteration(
    // Runs fisher's exact test or Chisquare test
    alternate_forward_count: u32,
    alternate_reverse_count: u32,
    reference_forward_count: u32,
    reference_reverse_count: u32,
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
            .greater_pvalue;
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
            .greater_pvalue;
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
        let total: f64 = (alternate_forward_count
            + alternate_reverse_count
            + reference_forward_count
            + reference_reverse_count) as f64;
        let expected_alternate_forward_count: f64 = (alternate_forward_count
            + alternate_reverse_count) as f64
            * (alternate_forward_count + reference_forward_count) as f64
            / total;
        let expected_alternate_reverse_count: f64 = (alternate_forward_count
            + alternate_reverse_count) as f64
            * (alternate_reverse_count + reference_reverse_count) as f64
            / total;
        let expected_reference_forward_count: f64 = (alternate_forward_count
            + reference_forward_count) as f64
            * (reference_forward_count + reference_reverse_count) as f64
            / total;
        let expected_reference_reverse_count: f64 = (reference_forward_count
            + reference_reverse_count) as f64
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
