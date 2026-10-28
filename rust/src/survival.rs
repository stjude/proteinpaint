// Survival analysis: Kaplan-Meier estimates of each series, and a log-rank test of each pair of series.
// This gives the same results as survfit() and survdiff() of the R survival package, with their default options.

// Usage: echo <in_json> | target/release/survival > <out_json>

// Input JSON, read from stdin:
// [
//   {
//     time: time to event
//     status: event code (0 = censored, 1 = dead)
//     series: series ID
//   }
// ]

// Output JSON, written to stdout:
// {
//   estimates: [{ series, time, surv, lower, upper, nevent, ncensor, nrisk }],
//   tests: [{ series1, series2, pvalue }]
// }
// The estimates of a series start with a time=0, surv=1 data point. lower and upper are the 95% confidence interval,
// with the log transformation, and are null where surv is 0. tests is only given for more than one series, and pvalue
// is a string with 2 significant digits.

// Example:
// cd ~/proteinpaint/rust && cargo build --release && json='[{"time":1,"status":1,"series":"A"},{"time":2,"status":0,"series":"A"},{"time":3,"status":1,"series":"A"},{"time":1.5,"status":1,"series":"B"},{"time":2.5,"status":1,"series":"B"},{"time":4,"status":0,"series":"B"}]' && echo "$json" | target/release/survival

use r_mathlib::{chi_squared_cdf, normal_quantile};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{self, Read};

#[derive(Deserialize)]
struct Observation {
    time: f64,
    status: f64,
    series: Value,
}

#[derive(Serialize)]
struct Estimate {
    series: String,
    time: f64,
    surv: f64,
    lower: Option<f64>,
    upper: Option<f64>,
    nevent: usize,
    ncensor: usize,
    nrisk: usize,
}

#[derive(Serialize)]
struct Test {
    series1: String,
    series2: String,
    pvalue: String,
}

#[derive(Serialize)]
struct Output {
    estimates: Vec<Estimate>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tests: Option<Vec<Test>>,
}

// (time, is event) of a sample
type Sample = (f64, bool);

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
    let observations: Vec<Observation> =
        serde_json::from_str(input).map_err(|e| format!("invalid input json: {}", e))?;
    if observations.is_empty() {
        return Err("no survival data".to_string());
    }

    for o in &observations {
        if !o.time.is_finite() {
            return Err(format!("invalid time: {}", o.time));
        }
        if o.status != 0.0 && o.status != 1.0 {
            return Err(format!("invalid status: {}", o.status));
        }
    }

    let labels: Vec<String> = observations
        .iter()
        .map(|o| series_label(&o.series))
        .collect::<Result<_, _>>()?;
    let series = ordered_series(&observations, &labels);

    // the samples of each series, sorted by time
    let mut samples: Vec<Vec<Sample>> = vec![Vec::new(); series.len()];
    for (i, o) in observations.iter().enumerate() {
        let k = series.iter().position(|s| *s == labels[i]).unwrap();
        samples[k].push((o.time, o.status == 1.0));
    }
    for s in samples.iter_mut() {
        s.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
    }

    // the R script that this replaces took the estimates of a series from survfit() of the first pair of series that
    // has it, so the times of a series are fixed with those of the first series, or of the second series for the first
    let z = normal_quantile(0.975, 0.0, 1.0, true, false);
    let mut estimates: Vec<Estimate> = Vec::new();
    if series.len() == 1 {
        estimates.extend(kaplan_meier(&series[0], &fix_series_times(&[&samples[0]])[0], z));
    } else {
        for (k, s) in series.iter().enumerate() {
            let fixed = fix_series_times(&[&samples[0], &samples[k.max(1)]]);
            estimates.extend(kaplan_meier(s, &fixed[k.min(1)], z));
        }
    }

    let mut tests: Option<Vec<Test>> = None;
    if series.len() > 1 {
        // the pairs are in the same order as combn() in R
        let mut lst: Vec<Test> = Vec::new();
        for i in 0..series.len() {
            for j in (i + 1)..series.len() {
                let fixed = fix_series_times(&[&samples[i], &samples[j]]);
                lst.push(Test {
                    series1: series[i].clone(),
                    series2: series[j].clone(),
                    pvalue: format_r(signif(logrank_pvalue(&fixed[0], &fixed[1]), 2)),
                });
            }
        }
        tests = Some(lst);
    }

    serde_json::to_string(&Output { estimates, tests }).map_err(|e| format!("cannot write output json: {}", e))
}

// the series ID as a string, as R reads it with as.factor()
fn series_label(v: &Value) -> Result<String, String> {
    match v {
        Value::String(s) => Ok(s.clone()),
        Value::Number(n) => Ok(format_r(n.as_f64().unwrap())),
        _ => Err(format!("invalid series: {}", v)),
    }
}

// the unique series, sorted as the factor levels in R: numerically when every series ID is a number, or else
// case-insensitively, with a lowercase letter before its uppercase one, which is closer than a byte order to the sort
// order of R in an English locale
fn ordered_series(observations: &[Observation], labels: &[String]) -> Vec<String> {
    let mut lst: Vec<(String, f64)> = Vec::new();
    for (i, o) in observations.iter().enumerate() {
        if !lst.iter().any(|(s, _)| *s == labels[i]) {
            lst.push((labels[i].clone(), o.series.as_f64().unwrap_or(f64::NAN)));
        }
    }
    if observations.iter().all(|o| o.series.is_number()) {
        lst.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
    } else {
        let swapcase = |s: &str| -> String {
            s.chars()
                .map(|c| {
                    if c.is_lowercase() {
                        c.to_ascii_uppercase()
                    } else {
                        c.to_ascii_lowercase()
                    }
                })
                .collect()
        };
        lst.sort_by_cached_key(|(s, _)| (s.to_lowercase(), swapcase(s)));
    }
    lst.into_iter().map(|(s, _)| s).collect()
}

// treats times that differ only by floating point error as tied, as aeqSurv() in R does by default: a time that is
// within the tolerance of the next smaller unique time is set to the smallest time of its run of such times
fn fix_times(times: &mut [f64]) {
    let tolerance = f64::EPSILON.sqrt();
    let mut unique: Vec<f64> = times.to_vec();
    unique.sort_by(|a, b| a.partial_cmp(b).unwrap());
    unique.dedup();
    let mean = unique.iter().map(|t| t.abs()).sum::<f64>() / unique.len() as f64;
    let mut cuts: Vec<f64> = vec![unique[0]];
    for w in unique.windows(2) {
        let dy = w[1] - w[0];
        if !(dy <= tolerance || dy / mean <= tolerance) {
            cuts.push(w[1]);
        }
    }
    if cuts.len() == unique.len() {
        return;
    }
    for t in times.iter_mut() {
        // the last cut that is <= t, as findInterval() in R
        let i = cuts.partition_point(|c| c <= t);
        *t = cuts[i - 1];
    }
}

// copies of the samples of the given series, with the times fixed over the samples of only these series, as survfit()
// and survdiff() in R fix the times of the data that they are given, so that another series cannot change the ties;
// the copies stay sorted by time, since a fixed time is never greater than the next fixed time
fn fix_series_times(series: &[&[Sample]]) -> Vec<Vec<Sample>> {
    let mut times: Vec<f64> = series.iter().flat_map(|s| s.iter().map(|x| x.0)).collect();
    fix_times(&mut times);
    let mut times = times.into_iter();
    series
        .iter()
        .map(|s| s.iter().map(|x| (times.next().unwrap(), x.1)).collect())
        .collect()
}

// the Kaplan-Meier estimates of a series, with samples sorted by time, as survfit() in R, at each unique time of an
// event or censoring, and a starting time=0, surv=1 data point; the standard error is from the Greenwood formula
fn kaplan_meier(series: &str, samples: &[Sample], z: f64) -> Vec<Estimate> {
    let mut estimates = vec![Estimate {
        series: series.to_string(),
        time: 0.0,
        surv: 1.0,
        lower: Some(1.0),
        upper: Some(1.0),
        nevent: 0,
        ncensor: 0,
        nrisk: samples.len(),
    }];
    let mut nrisk = samples.len();
    let mut surv = 1.0;
    let mut variance = 0.0; // of the cumulative hazard
    let mut i = 0;
    while i < samples.len() {
        let time = samples[i].0;
        let (mut nevent, mut ncensor) = (0, 0);
        while i < samples.len() && samples[i].0 == time {
            if samples[i].1 {
                nevent += 1;
            } else {
                ncensor += 1;
            }
            i += 1;
        }
        let (n, d) = (nrisk as f64, nevent as f64);
        surv *= (n - d) / n;
        if nevent < nrisk {
            variance += d / (n * (n - d));
        }
        let (lower, upper) = if surv > 0.0 {
            let se = variance.sqrt();
            Some(((surv.ln() - z * se).exp(), (surv.ln() + z * se).exp().min(1.0)))
        } else {
            None
        }
        .unzip();
        estimates.push(Estimate {
            series: series.to_string(),
            time,
            surv,
            lower,
            upper,
            nevent,
            ncensor,
            nrisk,
        });
        nrisk -= nevent + ncensor;
    }
    estimates
}

// the p-value of the log-rank test of two series, with samples sorted by time, as survdiff() in R
fn logrank_pvalue(a: &[Sample], b: &[Sample]) -> f64 {
    let (mut n1, mut n2) = (a.len() as f64, b.len() as f64);
    let (mut observed1, mut expected1, mut expected2, mut variance) = (0.0, 0.0, 0.0, 0.0);
    let (mut i, mut j) = (0, 0);
    while i < a.len() || j < b.len() {
        let time = match (a.get(i), b.get(j)) {
            (Some(x), Some(y)) => x.0.min(y.0),
            (Some(x), None) => x.0,
            (None, Some(y)) => y.0,
            (None, None) => unreachable!(),
        };
        let (mut d1, mut c1, mut d2, mut c2) = (0.0, 0.0, 0.0, 0.0);
        while i < a.len() && a[i].0 == time {
            if a[i].1 {
                d1 += 1.0
            } else {
                c1 += 1.0
            }
            i += 1;
        }
        while j < b.len() && b[j].0 == time {
            if b[j].1 {
                d2 += 1.0
            } else {
                c2 += 1.0
            }
            j += 1;
        }
        let (n, d) = (n1 + n2, d1 + d2);
        if d > 0.0 {
            observed1 += d1;
            expected1 += d * n1 / n;
            expected2 += d * n2 / n;
            if n > 1.0 {
                variance += d * (n1 / n) * (n2 / n) * (n - d) / (n - 1.0);
            }
        }
        n1 -= d1 + c1;
        n2 -= d2 + c2;
    }
    // survdiff() gives chisq=0 when a series has no expected events. A zero variance, such as when all samples of both
    // series have the same time and status, is an error in survdiff(), and gives pvalue=1 here instead
    if expected1 <= 0.0 || expected2 <= 0.0 || variance <= 0.0 {
        return 1.0;
    }
    let chisq = (observed1 - expected1).powi(2) / variance;
    // as 1 - pchisq() in R, so that a p-value that is too small for a double is 0
    1.0 - chi_squared_cdf(chisq, 1.0, true, false)
}

// rounds to the given number of significant digits, as signif() in R
fn signif(x: f64, digits: usize) -> f64 {
    if x == 0.0 || !x.is_finite() {
        return x;
    }
    format!("{:.*e}", digits - 1, x).parse().unwrap()
}

// a number as a string, as as.character() in R: with up to 15 significant digits, in fixed notation unless the
// scientific notation is shorter
fn format_r(x: f64) -> String {
    if x == 0.0 {
        return "0".to_string();
    }
    if !x.is_finite() {
        return if x.is_nan() {
            "NaN".to_string()
        } else if x > 0.0 {
            "Inf".to_string()
        } else {
            "-Inf".to_string()
        };
    }
    let sci = format!("{:.14e}", x);
    let (mantissa, exponent) = sci.split_once('e').unwrap();
    let exponent: i32 = exponent.parse().unwrap();
    let mantissa = mantissa.trim_end_matches('0').trim_end_matches('.');
    let ndigits = mantissa.chars().filter(|c| c.is_ascii_digit()).count() as i32;
    let sci = format!(
        "{}e{}{:02}",
        mantissa,
        if exponent < 0 { '-' } else { '+' },
        exponent.abs()
    );
    let fixed = format!("{:.*}", (ndigits - 1 - exponent).max(0) as usize, x);
    if fixed.len() <= sci.len() { fixed } else { sci }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_r() {
        assert_eq!(format_r(1e-4), "1e-04");
        assert_eq!(format_r(0.00012), "0.00012");
        assert_eq!(format_r(1.2e-5), "1.2e-05");
        assert_eq!(format_r(0.05), "0.05");
        assert_eq!(format_r(1.0), "1");
        assert_eq!(format_r(0.12), "0.12");
        assert_eq!(format_r(1.5e-10), "1.5e-10");
        assert_eq!(format_r(100000.0), "1e+05");
        assert_eq!(format_r(123456.0), "123456");
        assert_eq!(format_r(2.5), "2.5");
    }

    #[test]
    fn test_signif() {
        assert_eq!(signif(0.123456, 2), 0.12);
        assert_eq!(signif(0.0001234, 2), 0.00012);
    }
}
