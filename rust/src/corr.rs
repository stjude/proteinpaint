// Correlation test of each pair of vectors, and the Benjamini-Hochberg adjustment of their p-values.
// This gives the same results as cor.test() and p.adjust(method = "fdr") of R, with their default options:
// a two-sided test, and for Spearman, the exact p-value of algorithm AS 89 when there are no ties and n <= 1290,
// or else the t approximation.

// Usage: echo <in_json> | target/release/corr > <out_json>

// Input JSON, read from stdin:
// {
//   method: "pearson" (default) or "spearman"
//   terms: [{ id, v1: [numbers], v2: [numbers] }]
// }
// v1 and v2 of a term must have the same length. A null in v1 or v2 is a missing value, and the pair at that index
// is left out of the test, as cor.test() leaves out the incomplete cases.

// Output JSON, written to stdout, with one item per term in the input order:
// [{ id, correlation, original_p_value, adjusted_p_value, sample_size }]
// sample_size is the number of complete pairs. correlation and the p-values are null where R gives NA, such as for
// a constant vector, and where cor.test() would throw, which is for fewer than 3 complete pairs for Pearson and
// fewer than 2 for Spearman. adjusted_p_value is adjusted over the terms with a p-value, as p.adjust() does over
// the values that are not NA.

// Example:
// cd ~/proteinpaint/rust && cargo build --release && json='{"method":"spearman","terms":[{"id":"a","v1":[1,2,3,4,5],"v2":[2,1,4,3,5]},{"id":"b","v1":[1,2,3,4,5,6],"v2":[6,4,5,3,2,1]}]}' && echo "$json" | target/release/corr

use r_mathlib::{normal_cdf, students_t_cdf};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{self, Read};

#[derive(Deserialize)]
struct Input {
    method: Option<String>,
    terms: Vec<Term>,
}

#[derive(Deserialize)]
struct Term {
    id: Value,
    v1: Vec<Option<f64>>,
    v2: Vec<Option<f64>>,
}

#[derive(Serialize)]
struct Output {
    id: Value,
    correlation: Option<f64>,
    original_p_value: Option<f64>,
    adjusted_p_value: Option<f64>,
    sample_size: usize,
}

#[derive(Clone, Copy)]
enum Method {
    Pearson,
    Spearman,
}

fn main() {
    let mut input = String::new();
    if let Err(e) = io::stdin().read_to_string(&mut input) {
        eprintln!("cannot read input: {}", e);
        std::process::exit(1);
    }
    match run(&input) {
        Ok(output) => println!("{}", output),
        Err(e) => {
            eprintln!("{}", e);
            std::process::exit(1);
        }
    }
}

fn run(input: &str) -> Result<String, String> {
    let input: Input = serde_json::from_str(input).map_err(|e| format!("invalid input json: {}", e))?;
    let method = match input.method.as_deref() {
        None | Some("pearson") => Method::Pearson,
        Some("spearman") => Method::Spearman,
        Some(m) => return Err(format!("unsupported method: {}", m)),
    };

    let mut outputs = Vec::with_capacity(input.terms.len());
    for term in input.terms {
        if term.v1.len() != term.v2.len() {
            return Err(format!("v1 and v2 have different lengths for term {}", term.id));
        }
        // the complete cases
        let (x, y): (Vec<f64>, Vec<f64>) = term
            .v1
            .iter()
            .zip(term.v2.iter())
            .filter_map(|(a, b)| match (a, b) {
                (Some(a), Some(b)) => Some((*a, *b)),
                _ => None,
            })
            .unzip();
        let (correlation, p) = match method {
            Method::Pearson => pearson_test(&x, &y),
            Method::Spearman => spearman_test(&x, &y),
        };
        outputs.push(Output {
            id: term.id,
            correlation: correlation.filter(|v| !v.is_nan()),
            original_p_value: p.filter(|v| !v.is_nan()),
            adjusted_p_value: None,
            sample_size: x.len(),
        });
    }

    let pvalues: Vec<Option<f64>> = outputs.iter().map(|o| o.original_p_value).collect();
    for (o, adjusted) in outputs.iter_mut().zip(adjust_bh(&pvalues)) {
        o.adjusted_p_value = adjusted;
    }

    serde_json::to_string(&outputs).map_err(|e| format!("cannot write output json: {}", e))
}

/// mean() of R's cor(), in two passes for accuracy, see MEAN in R's src/library/stats/src/cov.c
fn mean(x: &[f64]) -> f64 {
    let n = x.len() as f64;
    let mut m = x.iter().sum::<f64>() / n;
    if m.is_finite() {
        let correction: f64 = x.iter().map(|v| v - m).sum();
        m += correction / n;
    }
    m
}

/// cor(x, y) of R, see cov_complete2() in R's src/library/stats/src/cov.c. None for a constant vector, which R
/// gives as NA.
fn cor(x: &[f64], y: &[f64]) -> Option<f64> {
    let n1 = x.len() as f64 - 1.0;
    let xm = mean(x);
    let ym = mean(y);
    let mut sxy = 0.0;
    let mut sxx = 0.0;
    let mut syy = 0.0;
    for (a, b) in x.iter().zip(y.iter()) {
        sxy += (a - xm) * (b - ym);
        sxx += (a - xm) * (a - xm);
        syy += (b - ym) * (b - ym);
    }
    let sdx = (sxx / n1).sqrt();
    let sdy = (syy / n1).sqrt();
    if sdx == 0.0 || sdy == 0.0 {
        return None;
    }
    let r = (sxy / n1) / (sdx * sdy);
    if r.is_nan() {
        return None;
    }
    Some(r.clamp(-1.0, 1.0))
}

/// rank(x) of R, with the average rank for ties
fn rank(x: &[f64]) -> Vec<f64> {
    let mut order: Vec<usize> = (0..x.len()).collect();
    order.sort_by(|&a, &b| x[a].total_cmp(&x[b]));
    let mut ranks = vec![0.0; x.len()];
    let mut i = 0;
    while i < order.len() {
        let mut j = i;
        while j + 1 < order.len() && x[order[j + 1]] == x[order[i]] {
            j += 1;
        }
        // 1-based positions i+1 to j+1
        let r = (i + j + 2) as f64 / 2.0;
        for k in i..=j {
            ranks[order[k]] = r;
        }
        i = j + 1;
    }
    ranks
}

fn count_unique(x: &[f64]) -> usize {
    let mut v = x.to_vec();
    v.sort_by(|a, b| a.total_cmp(b));
    v.dedup_by(|a, b| a == b);
    v.len()
}

/// two-sided Pearson test of cor.test(), as (estimate, p-value)
fn pearson_test(x: &[f64], y: &[f64]) -> (Option<f64>, Option<f64>) {
    let n = x.len();
    if n < 3 {
        return (None, None);
    }
    let r = match cor(x, y) {
        Some(r) => r,
        None => return (None, None),
    };
    let df = (n - 2) as f64;
    let t = df.sqrt() * r / (1.0 - r * r).sqrt();
    let p = 2.0 * students_t_cdf(t, df, true, false).min(students_t_cdf(t, df, false, false));
    (Some(r), Some(p))
}

/// two-sided Spearman test of cor.test(), as (estimate, p-value)
fn spearman_test(x: &[f64], y: &[f64]) -> (Option<f64>, Option<f64>) {
    let n = x.len();
    if n < 2 {
        return (None, None);
    }
    let ties = count_unique(x).min(count_unique(y)) < n;
    let r = match cor(&rank(x), &rank(y)) {
        Some(r) => r,
        None => return (None, None),
    };
    let nf = n as f64;
    let n3 = nf * nf * nf - nf;
    let q = n3 * (1.0 - r) / 6.0;
    let exact = !ties && n <= 1290;
    let pspearman = |lower_tail: bool| -> f64 {
        if exact {
            prho(n, q.round_ties_even() + if lower_tail { 2.0 } else { 0.0 }, lower_tail)
        } else {
            let den = (nf * (nf * nf - 1.0)) / 6.0;
            let r = 1.0 - q / den;
            students_t_cdf(r / ((1.0 - r * r) / (nf - 2.0)).sqrt(), nf - 2.0, !lower_tail, false)
        }
    };
    let p = if q > n3 / 6.0 {
        pspearman(false)
    } else {
        pspearman(true)
    };
    (Some(r), Some((2.0 * p).min(1.0)))
}

/// Pr[S >= is], or Pr[S < is] if lower_tail, where S is the sum of the squared rank differences of n pairs without
/// ties. A port of prho() in R's src/library/stats/src/prho.c, which is algorithm AS 89, Appl. Statist. (1975)
/// Vol. 24, No. 3, p. 377: exact for n <= 9, and an Edgeworth series expansion for larger n.
fn prho(n: usize, is: f64, lower_tail: bool) -> f64 {
    const N_SMALL: usize = 9;
    const C1: f64 = 0.2274;
    const C2: f64 = 0.2531;
    const C3: f64 = 0.1745;
    const C4: f64 = 0.0758;
    const C5: f64 = 0.1033;
    const C6: f64 = 0.3932;
    const C7: f64 = 0.0879;
    const C8: f64 = 0.0151;
    const C9: f64 = 0.0072;
    const C10: f64 = 0.0831;
    const C11: f64 = 0.0131;
    const C12: f64 = 4.6e-4;

    let pv = if lower_tail { 0.0 } else { 1.0 };
    if n <= 1 || is <= 0.0 {
        return pv;
    }
    let mut n3 = n as f64;
    n3 *= (n3 * n3 - 1.0) / 3.0; // the maximum of S, (n^3 - n)/3
    if is > n3 {
        return 1.0 - pv;
    }

    if n <= N_SMALL {
        // exact, by going through all the permutations
        let mut l: Vec<i64> = (1..=n as i64).collect();
        let nfac: i64 = (1..=n as i64).product();
        let ifr: i64 = if is == n3 {
            1
        } else {
            let mut ifr = 0;
            for _ in 0..nfac {
                let mut ise: i64 = 0;
                for (i, li) in l.iter().enumerate() {
                    let d = i as i64 + 1 - li;
                    ise += d * d;
                }
                if is <= ise as f64 {
                    ifr += 1;
                }
                let mut n1 = n;
                loop {
                    let mt = l[0];
                    for i in 1..n1 {
                        l[i - 1] = l[i];
                    }
                    n1 -= 1;
                    l[n1] = mt;
                    if !(mt == n1 as i64 + 1 && n1 > 1) {
                        break;
                    }
                }
            }
            ifr
        };
        return (if lower_tail { nfac - ifr } else { ifr }) as f64 / nfac as f64;
    }

    // Edgeworth series expansion
    let mut y = n as f64;
    let b = 1.0 / y;
    let x = (6.0 * (is - 1.0) * b / (y * y - 1.0) - 1.0) * (y - 1.0).sqrt();
    y = x * x;
    let u = x
        * b
        * (C1
            + b * (C2 + C3 * b)
            + y * (-C4 + b * (C5 + C6 * b) - y * b * (C7 + C8 * b - y * (C9 - C10 * b + y * b * (C11 - C12 * y)))));
    y = u / (y / 2.0).exp();
    let pv = (if lower_tail { -y } else { y }) + normal_cdf(x, 0.0, 1.0, lower_tail, false);
    pv.clamp(0.0, 1.0)
}

/// p.adjust(p, method = "BH") of R, which leaves out the missing values, both from the adjustment and from the
/// number of tests
fn adjust_bh(p: &[Option<f64>]) -> Vec<Option<f64>> {
    let mut adjusted = p.to_vec();
    // indices of the p-values, from the largest to the smallest
    let mut order: Vec<usize> = (0..p.len()).filter(|&i| p[i].is_some()).collect();
    let lp = order.len();
    if lp <= 1 {
        return adjusted;
    }
    order.sort_by(|&a, &b| p[b].unwrap().total_cmp(&p[a].unwrap()));
    let mut cummin = f64::INFINITY;
    for (k, &idx) in order.iter().enumerate() {
        let i = (lp - k) as f64;
        cummin = cummin.min(lp as f64 / i * p[idx].unwrap());
        adjusted[idx] = Some(cummin.min(1.0));
    }
    adjusted
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ranks_ties_with_average() {
        assert_eq!(rank(&[3.0, 1.0, 3.0, 2.0]), vec![3.5, 1.0, 3.5, 2.0]);
    }

    #[test]
    fn bh_skips_missing() {
        let out = adjust_bh(&[Some(0.01), None, Some(0.04), Some(0.03)]);
        assert_eq!(out[1], None);
        assert!((out[0].unwrap() - 0.03).abs() < 1e-15);
        assert!((out[2].unwrap() - 0.04).abs() < 1e-15);
        assert!((out[3].unwrap() - 0.04).abs() < 1e-15);
    }

    #[test]
    fn constant_vector_is_missing() {
        assert_eq!(pearson_test(&[1.0, 2.0, 3.0], &[1.0, 1.0, 1.0]), (None, None));
        assert_eq!(spearman_test(&[1.0, 2.0, 3.0], &[1.0, 1.0, 1.0]), (None, None));
    }
}
