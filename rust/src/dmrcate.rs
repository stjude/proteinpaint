// dmrcate.rs — Genome-wide empirical Bayes moderated t-test + DMRCate kernel smoothing
// Smyth 2004 (limma), Peters et al. 2015 (DMRCate), Phipson et al. 2016 (robust eBayes)
//
// Reads probe-level beta values from HDF5, runs chromosome-chunked OLS → genome-wide
// eBayes → regional kernel smoothing → DMR segmentation with proximity fallback.
// Usage: echo '{"probe_h5_file":"beta.h5","chr":"chr14","start":100000,"stop":105000,
//              "case":"s1,s2","control":"s3,s4"}' | target/release/dmrcate
//
// The matrix may also be an element matrix (promoters, cCREs) instead of a CpG one: one row is
// then one regulatory element rather than one CpG, and "mvalues":true says the stored values are
// already M-values. Everything downstream is unchanged -- an element is a probe with wider spacing.

use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use hdf5::File;
use hdf5::types::VarLenUnicode;
use serde_json::{Value, json};
use statrs::distribution::{ContinuousCDF, StudentsT};
use statrs::function::gamma::{digamma, gamma_ur, ln_gamma};
use std::collections::HashMap;
use std::io;
use std::time::Instant;
use tiny_skia::{FillRule, Paint, PathBuilder, Pixmap, Stroke, StrokeDash, Transform};

fn get_rss_mb() -> f64 {
    unsafe {
        let mut usage: libc::rusage = std::mem::zeroed();
        libc::getrusage(libc::RUSAGE_SELF, &mut usage);
        #[cfg(target_os = "macos")]
        {
            usage.ru_maxrss as f64 / 1_048_576.0
        } // bytes → MB
        #[cfg(not(target_os = "macos"))]
        {
            usage.ru_maxrss as f64 / 1024.0
        } // KB → MB
    }
}

fn trigamma(mut x: f64) -> f64 {
    if x <= 0.0 {
        return f64::NAN;
    }
    let mut r = 0.0;
    while x < 6.0 {
        r += 1.0 / (x * x);
        x += 1.0;
    }
    let x2 = x * x;
    r + 1.0 / x + 1.0 / (2.0 * x2) + 1.0 / (6.0 * x2 * x) - 1.0 / (30.0 * x2 * x2 * x) + 1.0 / (42.0 * x2 * x2 * x2 * x)
}

fn trigamma_deriv(mut x: f64) -> f64 {
    let mut r = 0.0;
    while x < 6.0 {
        r -= 2.0 / (x * x * x);
        x += 1.0;
    }
    let x2 = x * x;
    r - 1.0 / x2 - 1.0 / (x2 * x) - 1.0 / (2.0 * x2 * x2) + 1.0 / (6.0 * x2 * x2 * x2)
}

fn trigamma_inverse(x: f64) -> f64 {
    if x.is_nan() || x <= 0.0 {
        return f64::NAN;
    }
    let mut y = if x > 1e-6 { 1.0 / x.sqrt() } else { 1.0 / x };
    for _ in 0..8 {
        let delta = (trigamma(y) - x) / trigamma_deriv(y);
        y -= delta;
        if y <= 0.0 {
            y = 0.5 * (y + delta);
        }
        if delta.abs() < 1e-12 * y.abs() {
            break;
        }
    }
    y
}

fn bh_adjust(pvalues: &[f64]) -> Vec<f64> {
    let n = pvalues.len();
    if n == 0 {
        return vec![];
    }
    let mut idx: Vec<usize> = (0..n).collect();
    idx.sort_by(|&a, &b| pvalues[b].partial_cmp(&pvalues[a]).unwrap_or(std::cmp::Ordering::Equal));
    let mut adj = vec![0.0; n];
    let mut cummin = f64::INFINITY;
    for (rank_from_end, &i) in idx.iter().enumerate() {
        cummin = cummin.min(pvalues[i] * n as f64 / (n - rank_from_end) as f64);
        adj[i] = cummin.min(1.0);
    }
    adj
}

/* Running per-group methylation level, on the beta scale, accumulated over every value the fit
already reads. This is the cohort's GLOBAL level -- not a property of any region -- and it is what
tells a reader how much of a region result is just the whole genome moving. Accumulated before the
variance and coverage filters below, so it describes the matrix rather than the rows that survived
modelling. Free to compute: these values are already in registers for the stats. */
#[derive(Default, Clone, Copy)]
struct GlobalBeta {
    case_sum: f64,
    case_n: u64,
    ctrl_sum: f64,
    ctrl_n: u64,
}

struct ProbeStats {
    chr: String,
    start: i64,
    /* Absolute row of this probe in beta/values. Kept because the region pass needs to re-read the
    matrix for group means, and looking the row up by probe_id was a linear scan over every id in
    the file -- tolerable for one region, quadratic for a batch of thousands. */
    row: usize,
    log_fc: f64,
    residual_var: f64,
    df_residual: f64,
    stdev_unscaled: f64,
}

fn read_str_1d(file: &File, path: &str) -> Result<Vec<String>, String> {
    Ok(file
        .dataset(path)
        .map_err(|e| e.to_string())?
        .read_1d::<VarLenUnicode>()
        .map_err(|e| e.to_string())?
        .iter()
        .map(|s| s.to_string())
        .collect())
}

struct H5Meta {
    /// chromosome names in row order, with the number of rows each one occupies
    chr_names: Vec<String>,
    chr_rows: Vec<usize>,
    samples: Vec<String>,
    starts: Vec<i64>,
    /// probe id (CpG matrix) or element id (element matrix)
    row_ids: Vec<String>,
}

/* Two matrix layouts, one reader.

CpG/probe matrix:     rows are CpGs, chromosome row spans come from the `chrom_lengths`
                      root attribute, ids from /meta/probe/probeID.
Element matrix:       rows are regulatory elements (promoters, cCREs), carrying a per-row
                      /meta/chr instead of the root attribute and ids under
                      /meta/element/elementID (or /meta/promoter/promoterID on original
                      promoter-only builds). See query_element_values.py for the layout.

Both are sorted by chromosome then start, so a chromosome's rows are one contiguous slice
either way -- which is all the chunked fit below needs. */
fn read_h5_metadata(file: &File) -> Result<H5Meta, String> {
    let samples = read_str_1d(file, "meta/samples/names")?;
    let starts: Vec<i64> = file
        .dataset("meta/start")
        .map_err(|e| e.to_string())?
        .read_1d::<i64>()
        .map_err(|e| e.to_string())?
        .to_vec();
    let row_ids = read_str_1d(file, "meta/probe/probeID")
        .or_else(|_| read_str_1d(file, "meta/element/elementID"))
        .or_else(|_| read_str_1d(file, "meta/promoter/promoterID"))
        .map_err(|_| {
            "no row id dataset: expected meta/probe/probeID, meta/element/elementID or meta/promoter/promoterID"
                .to_string()
        })?;

    let root = file.group("/").map_err(|e| e.to_string())?;
    let (chr_names, chr_rows) = match root.attr("chrom_lengths") {
        Ok(a) => {
            let cl_json = a.read_scalar::<VarLenUnicode>().map_err(|e| e.to_string())?.to_string();
            // json crate preserves key order; serde_json::Map sorts alphabetically (wrong for chromosomes)
            let cl_parsed = json::parse(&cl_json).map_err(|e| format!("Failed to parse chrom_lengths: {}", e))?;
            let mut names = Vec::new();
            let mut lens = Vec::new();
            for (k, v) in cl_parsed.entries() {
                names.push(k.to_string());
                lens.push(v.as_u64().unwrap_or(0) as usize);
            }
            (names, lens)
        }
        Err(_) => {
            let chrs = read_str_1d(file, "meta/chr")
                .map_err(|_| "matrix has neither a chrom_lengths attribute nor meta/chr".to_string())?;
            let mut names: Vec<String> = Vec::new();
            let mut lens: Vec<usize> = Vec::new();
            for c in &chrs {
                if names.last().map(|l| l == c).unwrap_or(false) {
                    *lens.last_mut().unwrap() += 1;
                } else {
                    /* A chromosome coming back after another one means the rows are not sorted,
                    so a contiguous slice would silently mix chromosomes and mislabel every
                    probe's chromosome. Refuse rather than compute a wrong answer. */
                    if names.iter().any(|n| n == c) {
                        return Err(format!("meta/chr is not sorted: {} appears in more than one run", c));
                    }
                    names.push(c.clone());
                    lens.push(1);
                }
            }
            (names, lens)
        }
    };

    Ok(H5Meta {
        chr_names,
        chr_rows,
        samples,
        starts,
        row_ids,
    })
}

fn process_chromosome(
    file: &File,
    row_start: usize,
    row_end: usize,
    case_idx: &[usize],
    ctrl_idx: &[usize],
    chr: &str,
    starts: &[i64],
    min_spg: usize,
    // element matrices already store M-values, so the logit below must not run twice
    mvalues: bool,
) -> Result<(Vec<ProbeStats>, GlobalBeta), String> {
    let n_probes = row_end - row_start;
    let mut gb = GlobalBeta::default();
    if n_probes == 0 {
        return Ok((vec![], gb));
    }
    let ds = file.dataset("beta/values").map_err(|e| format!("beta/values: {}", e))?;
    let mut results = Vec::with_capacity(n_probes);
    // scratch, reused for every probe; see the comment in the row loop
    let mut cm: Vec<f64> = Vec::with_capacity(case_idx.len());
    let mut km: Vec<f64> = Vec::with_capacity(ctrl_idx.len());
    const CHUNK: usize = 1000;
    for chunk_i in 0..((n_probes + CHUNK - 1) / CHUNK) {
        let cs = chunk_i * CHUNK;
        let ce = std::cmp::min(cs + CHUNK, n_probes);
        let sel = hdf5::Selection::from((row_start + cs..row_start + ce, ..));
        let data = ds
            .read_slice_2d::<f32, _>(sel)
            .map_err(|e| format!("HDF5 read: {}", e))?;
        for lp in 0..(ce - cs) {
            let idx = row_start + cs + lp;
            let row = data.row(lp);
            /* Filled in place into buffers reused across rows. The previous version allocated five
            Vecs per probe (raw case, raw control, their M-transforms, and a concatenation of both):
            6.5 million allocations per chromosome on the MMRF shards, and every value transformed
            then copied a second time. Same arithmetic, same summation ORDER -- the sums below walk
            case then control exactly as iterating the old concatenation did, so results stay
            bit-identical rather than merely close. */
            cm.clear();
            km.clear();
            let mut n_case_raw = 0usize;
            let mut n_ctrl_raw = 0usize;
            for &si in case_idx {
                if si < row.len() {
                    let v = row[si] as f64;
                    if v.is_finite() {
                        /* Beta scale for the global level: the stats run on M-values, but a cohort
                        methylation level is only interpretable as a fraction methylated. */
                        gb.case_sum += if mvalues {
                            let e = v.exp2();
                            e / (1.0 + e)
                        } else {
                            v
                        };
                        gb.case_n += 1;
                        n_case_raw += 1;
                        cm.push(if mvalues {
                            v
                        } else {
                            let c = v.clamp(0.001, 0.999);
                            (c / (1.0 - c)).log2()
                        });
                    }
                }
            }
            for &si in ctrl_idx {
                if si < row.len() {
                    let v = row[si] as f64;
                    if v.is_finite() {
                        gb.ctrl_sum += if mvalues {
                            let e = v.exp2();
                            e / (1.0 + e)
                        } else {
                            v
                        };
                        gb.ctrl_n += 1;
                        n_ctrl_raw += 1;
                        km.push(if mvalues {
                            v
                        } else {
                            let c = v.clamp(0.001, 0.999);
                            (c / (1.0 - c)).log2()
                        });
                    }
                }
            }
            if n_case_raw < min_spg || n_ctrl_raw < min_spg {
                continue;
            }
            /* Passes fused: the pooled sum is accumulated alongside the per-group sums, and the
            pooled variance alongside the per-group sums of squares. Each accumulator still walks its
            own values in its original order, so this is bit-identical to computing them separately
            -- it just stops walking the same 365 values five times per probe. Profiling put 3933ms
            of a 4955ms chromosome in this loop against 287ms of HDF5 read, so passes are the cost. */
            let n_all = (cm.len() + km.len()) as f64;
            let (mut sum_all, mut sc, mut sk) = (0.0, 0.0, 0.0);
            for &x in cm.iter() {
                sum_all += x;
                sc += x;
            }
            for &x in km.iter() {
                sum_all += x;
                sk += x;
            }
            let mean_all = sum_all / n_all;
            let (n1, n2) = (cm.len() as f64, km.len() as f64);
            let (mc, mk) = (sc / n1, sk / n2);
            let (mut var, mut ss_c0, mut ss_k0) = (0.0, 0.0, 0.0);
            for &x in cm.iter() {
                var += (x - mean_all).powi(2);
                ss_c0 += (x - mc).powi(2);
            }
            for &x in km.iter() {
                var += (x - mean_all).powi(2);
                ss_k0 += (x - mk).powi(2);
            }
            var /= n_all - 1.0;
            if var <= 0.0 || !var.is_finite() {
                continue;
            }
            /* Two separate sums then added, NOT one running accumulator across both groups. The
            original wrote `cm.sum() + km.sum()`, and in floating point that is a different value
            from summing straight through -- enough to shift a residual variance, then a moderated
            t, then an FDR, then which probes a DMR spans. Preserving the association is what makes
            this rewrite verifiably identical rather than merely very close. */
            let ss = ss_c0 + ss_k0;
            let df = n1 + n2 - 2.0;
            let rv = ss / df;
            if !rv.is_finite() || rv <= 0.0 {
                continue;
            }
            let su = (1.0 / n1 + 1.0 / n2).sqrt();
            results.push(ProbeStats {
                chr: chr.to_string(),
                start: starts[idx],
                row: idx,
                log_fc: mc - mk,
                residual_var: rv,
                df_residual: df,
                stdev_unscaled: su,
            });
        }
    }
    Ok((results, gb))
}

fn fit_f_dist(vars: &[f64], dfs: &[f64]) -> (f64, f64) {
    if vars.len() < 3 {
        return (1.0, 0.0);
    }
    // Match R's fitFDist pre-processing:
    // 1. Filter to ok probes (finite df > 1e-15, finite var > -1e-15)
    // 2. Clamp var to max(var, 0), then floor at 1e-5 * median(var)
    let ok: Vec<usize> = (0..vars.len())
        .filter(|&i| dfs[i].is_finite() && dfs[i] > 1e-15 && vars[i].is_finite() && vars[i] > -1e-15)
        .collect();
    if ok.len() < 3 {
        return (1.0, 0.0);
    }
    let mut xv: Vec<f64> = ok.iter().map(|&i| vars[i].max(0.0)).collect();
    let xdf: Vec<f64> = ok.iter().map(|&i| dfs[i]).collect();
    // Median of variances
    let mut sorted_v = xv.clone();
    sorted_v.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let median_v = if sorted_v.len() % 2 == 0 {
        (sorted_v[sorted_v.len() / 2 - 1] + sorted_v[sorted_v.len() / 2]) / 2.0
    } else {
        sorted_v[sorted_v.len() / 2]
    };
    if median_v == 0.0 {
        return (1.0, f64::INFINITY);
    }
    // Floor small variances at 1e-5 * median (matches R's fitFDist)
    let floor = 1e-5 * median_v;
    for v in &mut xv {
        if *v < floor {
            *v = floor;
        }
    }
    let n = xv.len() as f64;
    // e = log(var) + logmdigamma(df/2) where logmdigamma(a) = log(a) - digamma(a)
    let e: Vec<f64> = xv
        .iter()
        .zip(xdf.iter())
        .map(|(&v, &d)| v.ln() + (d / 2.0).ln() - digamma(d / 2.0))
        .collect();
    let me = e.iter().sum::<f64>() / n;
    let ve = e.iter().map(|&ei| (ei - me).powi(2)).sum::<f64>() / (n - 1.0);
    let mean_tri: f64 = xdf.iter().map(|&d| trigamma(d / 2.0)).sum::<f64>() / n;
    let target = ve - mean_tri;
    let df0 = if target > 0.0 {
        2.0 * trigamma_inverse(target)
    } else {
        f64::INFINITY
    };
    let s20 = if df0.is_finite() {
        (me - (df0 / 2.0).ln() + digamma(df0 / 2.0)).exp()
    } else {
        xv.iter().sum::<f64>() / n
    };
    (s20, df0)
}

/// Log of the upper regularized incomplete gamma function Q(a, x).
/// Uses the continued fraction representation (Numerical Recipes / TOMS 708),
/// evaluated via modified Lentz's method. Returns the result in log space
/// so it never underflows, even for Q values as small as exp(-1e6).
/// This matches R's pgamma(x, a, lower.tail=FALSE, log.p=TRUE).
fn log_gamma_upper_cf(a: f64, x: f64) -> f64 {
    // Q(a, x) = exp(-x + a*ln(x) - lgamma(a)) * h
    // where h is the continued fraction. h is O(1/x) and well-behaved.
    let eps = 3e-14;
    let tiny = 1e-300;

    let mut b = x + 1.0 - a;
    let mut c = 1.0 / tiny;
    let mut d = 1.0 / b;
    let mut h = d;

    for i in 1..=300 {
        let an = -(i as f64) * (i as f64 - a);
        b += 2.0;
        d = an * d + b;
        if d.abs() < tiny {
            d = tiny;
        }
        c = b + an / c;
        if c.abs() < tiny {
            c = tiny;
        }
        d = 1.0 / d;
        let del = d * c;
        h *= del;
        if (del - 1.0).abs() < eps {
            break;
        }
    }

    -x + a * x.ln() - ln_gamma(a) + h.ln()
}

/// Log chi-squared survival function: returns log P(X > x) for X ~ chi^2(df).
/// Uses statrs gamma_ur for moderate tails, continued fraction in log space
/// for extreme tails. Matches R's pchisq(x, df, lower.tail=FALSE, log.p=TRUE).
fn log_chisq_sf(x: f64, df: f64) -> f64 {
    if x <= 0.0 || !x.is_finite() {
        return 0.0; // log(1) = 0
    }
    let a = df / 2.0;
    let z = x / 2.0;
    // For moderate tails, use statrs (accurate and fast)
    let sf = gamma_ur(a, z);
    if sf > 1e-300 {
        return sf.ln();
    }
    // For extreme tails, use continued fraction in log space
    log_gamma_upper_cf(a, z)
}

/// Kernel smoothing returning LOG p-values (not p-values) to avoid underflow.
fn kernel_smooth_log(pos: &[i64], t: &[f64], lambda: f64, c: f64) -> Vec<f64> {
    let sigma = lambda / c;
    let max_d = (5.0 * sigma) as i64;
    let two_s2 = 2.0 * sigma * sigma;
    let (n, mut l, mut r) = (pos.len(), 0usize, 0usize);
    let mut out = Vec::with_capacity(n);
    for i in 0..n {
        while r < n && (pos[r] - pos[i]).abs() <= max_d {
            r += 1;
        }
        while l < n && pos[i] - pos[l] > max_d {
            l += 1;
        }
        let (mut sky, mut sk, mut skk) = (0.0, 0.0, 0.0);
        for j in l..r {
            let dx = (pos[i] - pos[j]) as f64;
            let w = (-dx * dx / two_s2).exp();
            sky += w * t[j] * t[j];
            sk += w;
            skk += w * w;
        }
        let log_p = if sk > 0.0 && skk > 0.0 {
            let (exp, var) = (sk, 2.0 * skk);
            let (b, a) = (2.0 * exp * exp / var, var / (2.0 * exp));
            if b > 0.0 && a > 0.0 {
                log_chisq_sf(sky / a, b)
            } else {
                0.0
            }
        } else {
            0.0
        };
        out.push(log_p);
    }
    out
}

/// BH adjustment on log-scale p-values. Returns log-scale adjusted p-values.
/// adj_log_p[i] = cummin(log_p[i] + ln(n) - ln(rank)) capped at 0 (= log(1))
fn bh_adjust_log(log_pvalues: &[f64]) -> Vec<f64> {
    let n = log_pvalues.len();
    if n == 0 {
        return vec![];
    }
    let ln_n = (n as f64).ln();
    let mut idx: Vec<usize> = (0..n).collect();
    // Sort descending (largest log p first = least significant)
    idx.sort_by(|&a, &b| {
        log_pvalues[b]
            .partial_cmp(&log_pvalues[a])
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    let mut adj = vec![0.0f64; n];
    let mut cummin = 0.0f64; // log(1) = 0
    for (rank_from_end, &i) in idx.iter().enumerate() {
        let rank = n - rank_from_end; // 1-based rank from smallest
        let v = log_pvalues[i] + ln_n - (rank as f64).ln();
        cummin = cummin.min(v);
        adj[i] = cummin.min(0.0); // cap at log(1) = 0
    }
    adj
}

fn build_dmrs(
    chr: &str,
    pos: &[i64],
    fdr: &[f64],
    lfc: &[f64],
    mg1: &[f64],
    mg2: &[f64],
    cutoff: f64,
    lambda: f64,
    min_cpgs: usize,
    min_db: Option<f64>,
    check_direction: bool,
) -> Vec<Value> {
    let n = pos.len();
    let sig: Vec<usize> = (0..n)
        .filter(|&i| {
            if fdr[i] > cutoff {
                return false;
            }
            if let Some(db) = min_db {
                (mg2[i] - mg1[i]).abs() >= db
            } else {
                true
            }
        })
        .collect();
    if sig.len() < min_cpgs {
        return vec![];
    }
    let mut groups: Vec<Vec<usize>> = Vec::new();
    let mut grp = vec![sig[0]];
    for k in 1..sig.len() {
        let (p, c) = (*grp.last().unwrap(), sig[k]);
        let same_dir = !check_direction || (lfc[c] >= 0.0) == (lfc[p] >= 0.0);
        if same_dir && (pos[c] - pos[p]) <= lambda as i64 {
            grp.push(c);
        } else {
            groups.push(grp);
            grp = vec![c];
        }
    }
    groups.push(grp);
    groups
        .iter()
        .filter(|g| g.len() >= min_cpgs)
        .map(|g| {
            let deltas: Vec<f64> = g.iter().map(|&j| mg2[j] - mg1[j]).collect();
            let fdrs: Vec<f64> = g.iter().map(|&j| fdr[j]).collect();
            let md = deltas.iter().sum::<f64>() / deltas.len() as f64;
            let mxd = if md >= 0.0 {
                deltas.iter().cloned().fold(f64::NEG_INFINITY, f64::max)
            } else {
                deltas.iter().cloned().fold(f64::INFINITY, f64::min)
            };
            json!({ "chr": chr, "start": pos[*g.first().unwrap()], "stop": pos[*g.last().unwrap()],
            "no_cpgs": g.len(), "min_smoothed_fdr": fdrs.iter().cloned().fold(f64::INFINITY, f64::min),
            "HMFDR": fdrs.len() as f64 / fdrs.iter().map(|&f| 1.0/f.max(1e-300)).sum::<f64>(),
            "maxdiff": mxd, "meandiff": md, "direction": if md >= 0.0 {"hyper"} else {"hypo"},
            "overlapping_genes": null })
        })
        .collect()
}

macro_rules! bail { ($($t:tt)*) => { { println!("{}", json!({"error": format!($($t)*)})); return; } } }

/// The genome-wide fit, computed once per matrix and reused by every region drawn from it.
struct Fit {
    all: Vec<ProbeStats>,
    mod_t: Vec<f64>,
    adj_p: Vec<f64>,
}

/// Region-calling knobs, all from the request.
struct RegionParams {
    lambda: f64,
    c_param: f64,
    fdr_cut: f64,
    min_db: f64,
}

/// Everything one region produces. The single-region path uses all of it (LOESS, PNG,
/// diagnostics); a batch keeps only `dmrs` and the two counts.
struct RegionResult {
    rpos: Vec<i64>,
    rfdr: Vec<f64>,
    rlfc: Vec<f64>,
    mg1: Vec<f64>,
    mg2: Vec<f64>,
    sfdr: Vec<f64>,
    dmrs: Vec<Value>,
    n_sig_probes: usize,
}

/* Call DMRs in one region against an already-fitted model.
Split out of main() so a batch can amortise the fit: eBayes and the BH correction run over the
whole matrix and are identical for every region drawn from it, so the expensive part is done
once and this runs per region. Behaviour for a single region is unchanged. */
fn call_region(
    fit: &Fit,
    file: &File,
    ci: &[usize],
    ki: &[usize],
    mvalues: bool,
    qchr: &str,
    qstart: i64,
    qstop: i64,
    p: &RegionParams,
) -> Option<RegionResult> {
    let ri: Vec<usize> = (0..fit.all.len())
        .filter(|&i| fit.all[i].chr == qchr && fit.all[i].start >= qstart && fit.all[i].start <= qstop)
        .collect();
    if ri.is_empty() {
        return None;
    }
    let rpos: Vec<i64> = ri.iter().map(|&i| fit.all[i].start).collect();
    let rt: Vec<f64> = ri.iter().map(|&i| fit.mod_t[i]).collect();
    let rfdr: Vec<f64> = ri.iter().map(|&i| fit.adj_p[i]).collect();
    let rlfc: Vec<f64> = ri.iter().map(|&i| fit.all[i].log_fc).collect();

    /* Group means are the DISPLAY scale: the track PNG, the LOESS curves and the DMR
    maxdiff/meandiff are all beta-scale (0-1), and the client labels them as such. An element
    matrix stores M-values, so undo the logit here -- per sample before averaging, matching how
    diffMeth.R reports mean betas. The stats above stay on M-values either way. */
    let to_beta = |v: f64| -> f64 {
        if !mvalues {
            return v;
        }
        let e = v.exp2();
        e / (1.0 + e)
    };
    let (mut mg1, mut mg2) = (Vec::with_capacity(ri.len()), Vec::with_capacity(ri.len()));
    /* One slab read spanning the region's rows, rather than a single-row read per probe. The
    region's probes are consecutive rows (both layouts are position-sorted); rows dropped by the
    variance filter sit inside the span and are simply skipped over, so the slab is a handful of
    rows wider than the probe count at most. */
    let rows_abs: Vec<usize> = ri.iter().map(|&i| fit.all[i].row).collect();
    let (lo, hi) = (rows_abs[0], *rows_abs.last().unwrap());
    let slab = file
        .dataset("beta/values")
        .ok()
        .and_then(|d| d.read_slice_2d::<f32, _>(hdf5::Selection::from((lo..hi + 1, ..))).ok());
    for &r in &rows_abs {
        match &slab {
            Some(s) if r >= lo && r - lo < s.nrows() => {
                let row = s.row(r - lo);
                let (mut cs, mut cc, mut ks, mut kc) = (0.0, 0, 0.0, 0);
                for &si in ki {
                    if si < row.len() {
                        let v = row[si] as f64;
                        if v.is_finite() {
                            ks += to_beta(v);
                            kc += 1;
                        }
                    }
                }
                for &si in ci {
                    if si < row.len() {
                        let v = row[si] as f64;
                        if v.is_finite() {
                            cs += to_beta(v);
                            cc += 1;
                        }
                    }
                }
                mg1.push(if kc > 0 { ks / kc as f64 } else { f64::NAN });
                mg2.push(if cc > 0 { cs / cc as f64 } else { f64::NAN });
            }
            _ => {
                mg1.push(f64::NAN);
                mg2.push(f64::NAN);
            }
        }
    }

    // Kernel smoothing in log space to avoid underflow for extreme t-statistics
    let log_smoothed = kernel_smooth_log(&rpos, &rt, p.lambda, p.c_param);
    let log_sfdr = bh_adjust_log(&log_smoothed);
    // Convert log FDR to linear for diagnostic output and Sig. CpGs track
    let sfdr: Vec<f64> = log_sfdr.iter().map(|&v| v.exp()).collect();
    // Adaptive threshold matching R's dmrcate(): select the same NUMBER of CpGs
    // as are per-CpG significant, but ranked by smoothed FDR instead.
    // Work in log space so extreme p-values maintain proper ordering.
    let nsig = rfdr.iter().filter(|&&f| f < p.fdr_cut).count();
    /* The adaptive rule takes the nsig SMALLEST smoothed FDRs. When nsig is zero that set is
    empty, and there is nothing to call.

    This branch used to fall back to comparing the SMOOTHED fdr against the raw per-probe cutoff,
    and that is not a conservative default -- it is a catastrophic one. Kernel smoothing pools
    roughly 25 neighbouring probes, so a smoothed FDR is orders of magnitude smaller than any
    per-probe FDR; on a chromosome with no signal at all it still dips below 0.05 across long
    stretches. "Nothing is significant" therefore produced thousands of DMRs.

    Measured on MMRF male-vs-female, where the answer is known: every chromosome reporting
    nsig == 0 emitted a large false set (chr3: 0 significant probes, 4,570 DMRs; chr11: 0 and
    2,733), while every chromosome with even one significant probe emitted 0 or 1. chrX, the real
    signal, has 104,218 significant probes. The bug was invisible on any single chromosome that
    happened to carry signal, which is why the drill-down and the chrX/chr7 scans never showed it. */
    let sig_fdr: Vec<f64> = select_significant(&log_sfdr, nsig);
    let mut dmrs = build_dmrs(qchr, &rpos, &sig_fdr, &rlfc, &mg1, &mg2, 0.5, p.lambda, 2, None, false);
    for dmr in &mut dmrs {
        if let (Some(s), Some(e)) = (dmr["start"].as_i64(), dmr["stop"].as_i64()) {
            let min_sfdr = rpos
                .iter()
                .zip(sfdr.iter())
                .filter(|(&pp, _)| pp >= s && pp <= e)
                .map(|(_, &f)| f)
                .fold(f64::INFINITY, f64::min);
            dmr["min_smoothed_fdr"] = json!(min_sfdr);
        }
    }
    if dmrs.is_empty() {
        dmrs = build_dmrs(
            qchr,
            &rpos,
            &rfdr,
            &rlfc,
            &mg1,
            &mg2,
            p.fdr_cut,
            p.lambda,
            2,
            Some(p.min_db),
            true,
        );
    }
    Some(RegionResult {
        rpos,
        rfdr,
        rlfc,
        mg1,
        mg2,
        sfdr,
        dmrs,
        n_sig_probes: nsig,
    })
}

/// Mark the `nsig` probes with the smallest smoothed FDR as significant (0.0), the rest 1.0 --
/// R's dmrcate rule, which selects the same NUMBER of CpGs as pass per-CpG significance but ranks
/// them by the smoothed statistic. Operates on log FDR so extreme p-values keep their ordering.
///
/// nsig == 0 must select NOTHING. Comparing the smoothed FDR against the raw cutoff instead is not
/// a conservative fallback but a catastrophic one: smoothing pools ~25 neighbouring probes, so a
/// smoothed FDR is orders of magnitude below any per-probe FDR and stays under 0.05 across long
/// stretches of a chromosome carrying no signal at all. That turned "nothing is significant" into
/// thousands of DMRs -- on MMRF male-vs-female, chr3 reported 0 significant probes and 4,570 DMRs
/// while chrX, the real signal, reported 104,218 and 6,472.
fn select_significant(log_sfdr: &[f64], nsig: usize) -> Vec<f64> {
    if nsig == 0 {
        return vec![1.0; log_sfdr.len()];
    }
    let mut sorted_log: Vec<f64> = log_sfdr.to_vec();
    sorted_log.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    // nsig-th smallest log FDR (most negative = most significant)
    let adaptive_log_cut = sorted_log[nsig.min(sorted_log.len()) - 1];
    log_sfdr
        .iter()
        .map(|&v| if v <= adaptive_log_cut { 0.0 } else { 1.0 })
        .collect()
}

/// LOESS (locally weighted scatterplot smoothing) with tricube weights and local linear fit.
/// Returns (fitted, ci_lower, ci_upper) evaluated at `eval_at` positions, clamped to [0,1].
fn loess_fit(pos: &[i64], vals: &[f64], eval_at: &[f64], span: f64) -> Option<(Vec<f64>, Vec<f64>, Vec<f64>)> {
    // Collect valid (x, y) pairs (skip NaN)
    let mut xs = Vec::new();
    let mut ys = Vec::new();
    for i in 0..pos.len() {
        if vals[i].is_finite() {
            xs.push(pos[i] as f64);
            ys.push(vals[i]);
        }
    }
    let n = xs.len();
    if n < 4 {
        return None;
    }

    let k = ((span * n as f64).ceil() as usize).max(3).min(n);

    let mut fitted = Vec::with_capacity(eval_at.len());
    let mut ci_lo = Vec::with_capacity(eval_at.len());
    let mut ci_hi = Vec::with_capacity(eval_at.len());

    for &x0 in eval_at {
        // Find k nearest neighbors by distance
        let mut dists: Vec<(usize, f64)> = xs.iter().enumerate().map(|(i, &xi)| (i, (xi - x0).abs())).collect();
        dists.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
        let h = dists[k - 1].1.max(1.0); // bandwidth = distance to k-th nearest

        // Tricube weights
        let mut w = vec![0.0; n];
        for &(i, d) in dists.iter().take(k) {
            let u = d / h;
            if u < 1.0 {
                let t = 1.0 - u * u * u;
                w[i] = t * t * t;
            }
        }

        // Weighted linear regression: y = a + b*(x - x0)
        let mut sw = 0.0;
        let mut swx = 0.0;
        let mut swy = 0.0;
        let mut swxx = 0.0;
        let mut swxy = 0.0;
        for i in 0..n {
            if w[i] == 0.0 {
                continue;
            }
            let dx = xs[i] - x0;
            sw += w[i];
            swx += w[i] * dx;
            swy += w[i] * ys[i];
            swxx += w[i] * dx * dx;
            swxy += w[i] * dx * ys[i];
        }
        if sw == 0.0 {
            fitted.push(f64::NAN);
            ci_lo.push(f64::NAN);
            ci_hi.push(f64::NAN);
            continue;
        }
        let det = sw * swxx - swx * swx;
        let (a, _b) = if det.abs() < 1e-20 {
            (swy / sw, 0.0)
        } else {
            ((swxx * swy - swx * swxy) / det, (sw * swxy - swx * swy) / det)
        };
        let y_hat = a; // at x = x0, dx = 0, so y = a

        // Weighted residual variance for CI
        let mut sse = 0.0;
        let mut sw2 = 0.0;
        for i in 0..n {
            if w[i] == 0.0 {
                continue;
            }
            let dx = xs[i] - x0;
            let pred = a + _b * dx;
            let e = ys[i] - pred;
            sse += w[i] * e * e;
            sw2 += w[i] * w[i];
        }
        // Effective df ≈ sum(w)^2 / sum(w^2) - 2
        let eff_n = (sw * sw / sw2).max(3.0);
        let sigma2 = sse / (eff_n - 2.0).max(1.0);
        let se = (sigma2 / sw).sqrt();

        // 95% CI with normal approximation (effective n is typically large for LOESS)
        let margin = 1.96 * se;
        fitted.push((y_hat * 10000.0).round() / 10000.0);
        ci_lo.push(((y_hat - margin).max(0.0).min(1.0) * 10000.0).round() / 10000.0);
        ci_hi.push(((y_hat + margin).max(0.0).min(1.0) * 10000.0).round() / 10000.0);
    }

    // Clamp fitted values
    for v in fitted.iter_mut() {
        *v = v.max(0.0).min(1.0);
    }

    Some((fitted, ci_lo, ci_hi))
}

fn hex_to_rgba(hex: &str, alpha: u8) -> (u8, u8, u8, u8) {
    let hex = hex.trim_start_matches('#');
    let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(128);
    let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(128);
    let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(128);
    (r, g, b, alpha)
}

/// Render the complete Per-CpG Means track as a transparent PNG.
fn render_track_png(
    rpos: &[i64],
    mg1: &[f64],
    mg2: &[f64],
    fdr: &[f64],
    _dmrs: &[Value],
    loess_g1: &Option<(Vec<f64>, Vec<f64>, Vec<f64>)>,
    loess_g2: &Option<(Vec<f64>, Vec<f64>, Vec<f64>)>,
    eval_pos: &[f64],
    xmin: f64,
    xmax: f64,
    width: u32,
    height: u32,
    dpr: f32,
    fdr_cutoff: f64,
    max_loess_region: f64,
    colors: &HashMap<String, String>,
) -> Option<String> {
    let w = (width as f32 * dpr) as u32;
    let h = (height as f32 * dpr) as u32;
    let mut pixmap = Pixmap::new(w, h)?;
    // Transparent background (default)

    let wf = w as f32;
    let hf = h as f32;
    let x_range = (xmax - xmin).max(1.0) as f32;
    let scale_x = |pos: f64| -> f32 { ((pos - xmin) as f32 / x_range) * wf };
    let scale_y = |beta: f64| -> f32 { hf - (beta as f32) * hf };

    let c_g1 = colors.get("group1").map(|s| s.as_str()).unwrap_or("#3b5ee6");
    let c_g2 = colors.get("group2").map(|s| s.as_str()).unwrap_or("#c04e00");

    // DMR region shading omitted — already shown as a bedj track above

    // 1. LOESS curves (if region small enough)
    let region_size = xmax - xmin;
    if region_size <= max_loess_region {
        let loess_groups: [(&Option<(Vec<f64>, Vec<f64>, Vec<f64>)>, &str); 2] = [(&loess_g1, c_g1), (&loess_g2, c_g2)];
        for (loess_opt, color_hex) in &loess_groups {
            if let Some((fitted, ci_lo, ci_hi)) = loess_opt {
                if fitted.is_empty() {
                    continue;
                }
                let (r, g, b, _) = hex_to_rgba(color_hex, 255);

                // CI bounds as dashed lines
                for ci_band in [ci_hi, ci_lo] {
                    let mut pb = PathBuilder::new();
                    let mut started = false;
                    for (i, &pos) in eval_pos.iter().enumerate() {
                        let px = scale_x(pos);
                        let py = scale_y(ci_band[i].max(0.0).min(1.0));
                        if !started {
                            pb.move_to(px, py);
                            started = true;
                        } else {
                            pb.line_to(px, py);
                        }
                    }
                    if let Some(path) = pb.finish() {
                        let mut paint = Paint::default();
                        paint.set_color_rgba8(r, g, b, 128); // ~0.5 alpha
                        paint.anti_alias = true;
                        let mut stroke = Stroke::default();
                        stroke.width = 1.0 * dpr;
                        stroke.dash = StrokeDash::new(vec![4.0 * dpr, 4.0 * dpr], 0.0);
                        pixmap.stroke_path(&path, &paint, &stroke, Transform::identity(), None);
                    }
                }

                // Fitted curve as solid line
                let mut pb = PathBuilder::new();
                let mut started = false;
                for (i, &pos) in eval_pos.iter().enumerate() {
                    let px = scale_x(pos);
                    let py = scale_y(fitted[i].max(0.0).min(1.0));
                    if !started {
                        pb.move_to(px, py);
                        started = true;
                    } else {
                        pb.line_to(px, py);
                    }
                }
                if let Some(path) = pb.finish() {
                    let mut paint = Paint::default();
                    paint.set_color_rgba8(r, g, b, 204); // ~0.8 alpha
                    paint.anti_alias = true;
                    let mut stroke = Stroke::default();
                    stroke.width = 2.0 * dpr;
                    pixmap.stroke_path(&path, &paint, &stroke, Transform::identity(), None);
                }
            }
        }
    }

    // 3. Scatter dots
    let dot_radius = 4.0 * dpr;
    for i in 0..rpos.len() {
        let px = scale_x(rpos[i] as f64);
        let is_sig = fdr[i] < fdr_cutoff;
        let alpha = if is_sig { 217u8 } else { 77u8 }; // 0.85 * 255, 0.3 * 255

        // Group 1
        if mg1[i].is_finite() {
            let py = scale_y(mg1[i]);
            let (r, g, b, _) = hex_to_rgba(c_g1, alpha);
            let mut paint = Paint::default();
            paint.set_color_rgba8(r, g, b, alpha);
            paint.anti_alias = true;
            let mut pb = PathBuilder::new();
            pb.push_circle(px, py, dot_radius);
            if let Some(path) = pb.finish() {
                pixmap.fill_path(&path, &paint, FillRule::Winding, Transform::identity(), None);
            }
        }

        // Group 2
        if mg2[i].is_finite() {
            let py = scale_y(mg2[i]);
            let (r, g, b, _) = hex_to_rgba(c_g2, alpha);
            let mut paint = Paint::default();
            paint.set_color_rgba8(r, g, b, alpha);
            paint.anti_alias = true;
            let mut pb = PathBuilder::new();
            pb.push_circle(px, py, dot_radius);
            if let Some(path) = pb.finish() {
                pixmap.fill_path(&path, &paint, FillRule::Winding, Transform::identity(), None);
            }
        }
    }

    let png_bytes = pixmap.encode_png().ok()?;
    Some(format!("data:image/png;base64,{}", BASE64.encode(&png_bytes)))
}

fn main() {
    let t0 = Instant::now();
    let rss_start = get_rss_mb();
    let mut input = String::new();
    if io::stdin().read_line(&mut input).is_err() {
        bail!("Failed to read stdin");
    }
    let p: Value = match serde_json::from_str(&input) {
        Ok(v) => v,
        Err(e) => bail!("Invalid JSON: {}", e),
    };

    let h5_path = p["probe_h5_file"].as_str().unwrap_or("");
    let cachedir = p["cachedir"].as_str().unwrap_or("/tmp");
    let dmrcate_dir = format!("{}/dmrcate", cachedir);
    let _ = std::fs::create_dir_all(&dmrcate_dir);
    let qchr = p["chr"].as_str().unwrap_or("");
    let (qstart, qstop) = (p["start"].as_i64().unwrap_or(0), p["stop"].as_i64().unwrap_or(0));
    let cases: Vec<&str> = p["case"]
        .as_str()
        .unwrap_or("")
        .split(',')
        .filter(|s| !s.is_empty())
        .collect();
    let ctrls: Vec<&str> = p["control"]
        .as_str()
        .unwrap_or("")
        .split(',')
        .filter(|s| !s.is_empty())
        .collect();
    let fdr_cut = p["fdr_cutoff"].as_f64().unwrap_or(0.05);
    let lambda = p["lambda"].as_f64().unwrap_or(1000.0);
    let c_param = p["C"].as_f64().unwrap_or(2.0);
    let min_db = p["min_delta_beta"].as_f64().unwrap_or(0.05);
    let min_spg = p["min_samples_per_group"].as_u64().unwrap_or(3) as usize;
    /* Set by the server from the ds config entry, never by the client: an element matrix stores
    M-values where a CpG matrix stores betas. Same contract as diffMeth.R. */
    let mvalues = p["mvalues"].as_bool().unwrap_or(false);
    /* Optional batch: call DMRs in many regions against one fit. Regions may name any chromosome
    the matrix holds; with per-chromosome shards that is just the one, and the caller groups its
    hit list by chromosome and invokes once per shard. Absent means the single-region path below,
    which is unchanged. */
    let batch_regions: Vec<(String, i64, i64)> = p["regions"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|r| {
                    let c = r["chr"].as_str().unwrap_or(qchr);
                    let (s, e) = (r["start"].as_i64()?, r["stop"].as_i64()?);
                    if c.is_empty() || e < s {
                        None
                    } else {
                        Some((c.to_string(), s, e))
                    }
                })
                .collect()
        })
        .unwrap_or_default();
    let block_width = p["blockWidth"].as_u64().unwrap_or(800) as u32;
    let device_pixel_ratio = p["devicePixelRatio"].as_f64().unwrap_or(1.0) as f32;
    let max_loess_region = p["maxLoessRegion"].as_f64().unwrap_or(50000.0);
    let track_height = 150u32;
    let mut render_colors: HashMap<String, String> = HashMap::new();
    if let Some(obj) = p["colors"].as_object() {
        for (k, v) in obj {
            if let Some(s) = v.as_str() {
                render_colors.insert(k.clone(), s.to_string());
            }
        }
    }

    if h5_path.is_empty() || qchr.is_empty() || cases.is_empty() || ctrls.is_empty() {
        bail!("Missing required parameters");
    }

    let file = match File::open(h5_path) {
        Ok(f) => f,
        Err(e) => bail!("HDF5 open: {}", e),
    };
    let meta = match read_h5_metadata(&file) {
        Ok(m) => m,
        Err(e) => bail!("{}", e),
    };
    let H5Meta {
        chr_names,
        chr_rows: chr_lens,
        samples: sample_names,
        starts,
        row_ids: _probe_ids,
    } = meta;
    let smap: HashMap<&str, usize> = sample_names.iter().enumerate().map(|(i, s)| (s.as_str(), i)).collect();
    let ci: Vec<usize> = cases.iter().filter_map(|s| smap.get(s).copied()).collect();
    let ki: Vec<usize> = ctrls.iter().filter_map(|s| smap.get(s).copied()).collect();
    if ci.len() < min_spg || ki.len() < min_spg {
        bail!("Not enough samples: case={}, control={}", ci.len(), ki.len());
    }
    let mut all: Vec<ProbeStats> = Vec::new();
    let mut global = GlobalBeta::default();
    let mut pfx = 0usize;
    for (i, &cl) in chr_lens.iter().enumerate() {
        if cl == 0 {
            pfx += cl;
            continue;
        }
        match process_chromosome(&file, pfx, pfx + cl, &ci, &ki, &chr_names[i], &starts, min_spg, mvalues) {
            Ok((s, g)) => {
                all.extend(s);
                global.case_sum += g.case_sum;
                global.case_n += g.case_n;
                global.ctrl_sum += g.ctrl_sum;
                global.ctrl_n += g.ctrl_n;
            }
            Err(_e) => {}
        }
        pfx += cl;
    }
    if all.len() < 3 {
        bail!("Too few probes after filtering ({})", all.len());
    }

    let all_vars: Vec<f64> = all.iter().map(|s| s.residual_var).collect();
    let all_dfs: Vec<f64> = all.iter().map(|s| s.df_residual).collect();
    let (s20, df0) = fit_f_dist(&all_vars, &all_dfs);
    let mut mod_t = Vec::with_capacity(all.len());
    let mut raw_p = Vec::with_capacity(all.len());
    for s in &all {
        let s2p = if df0.is_finite() {
            (df0 * s20 + s.df_residual * s.residual_var) / (df0 + s.df_residual)
        } else {
            s.residual_var
        };
        let t = s.log_fc / (s2p.sqrt() * s.stdev_unscaled);
        let df_tot = s.df_residual + df0;
        let tdist = StudentsT::new(0.0, 1.0, df_tot).unwrap_or_else(|_| StudentsT::new(0.0, 1.0, 100.0).unwrap());
        mod_t.push(t);
        raw_p.push(2.0 * tdist.sf(t.abs()));
    }
    let adj_p = bh_adjust(&raw_p);

    let fit = Fit { all, mod_t, adj_p };
    let rp = RegionParams {
        lambda,
        c_param,
        fdr_cut,
        min_db,
    };

    /* Group means on the beta scale plus their difference -- the global shift. A region result
    should always be read against this: on a contrast where the whole genome moves, part of every
    region's difference is this number rather than anything local. */
    let gmean = |sum: f64, n: u64| if n > 0 { sum / n as f64 } else { f64::NAN };
    let g_ctrl = gmean(global.ctrl_sum, global.ctrl_n);
    let g_case = gmean(global.case_sum, global.case_n);
    let global_json = json!({
        "control_mean_beta": if g_ctrl.is_finite() { json!((g_ctrl * 100000.0).round() / 100000.0) } else { Value::Null },
        "case_mean_beta": if g_case.is_finite() { json!((g_case * 100000.0).round() / 100000.0) } else { Value::Null },
        "shift": if g_ctrl.is_finite() && g_case.is_finite() { json!(((g_case - g_ctrl) * 100000.0).round() / 100000.0) } else { Value::Null },
        "values_counted": global.case_n + global.ctrl_n
    });

    /* Batch mode: many regions against the one fit above. The fit and the BH correction are what
    cost seconds here -- they run over the whole matrix and are identical for every region drawn
    from it -- so one call with N regions is dramatically cheaper than N single-region calls. The
    per-region track PNG and LOESS are skipped: a caller asking for hundreds of regions wants the
    DMR calls, and rendering hundreds of images would be most of the runtime. */
    if !batch_regions.is_empty() {
        let out: Vec<Value> = batch_regions
            .iter()
            .map(
                |(c, s, e)| match call_region(&fit, &file, &ci, &ki, mvalues, c, *s, *e, &rp) {
                    Some(r) => json!({
                        "chr": c, "start": s, "stop": e,
                        "n_probes": r.rpos.len(),
                        "n_sig_probes": r.n_sig_probes,
                        "dmrs": r.dmrs
                    }),
                    /* An empty region is a valid answer, not an error: the caller asked about a window
                    this matrix has no probes in. Emitting the row keeps the response aligned with the
                    request, so a caller can zip the two without tracking which ones dropped out. */
                    None => json!({"chr": c, "start": s, "stop": e, "n_probes": 0, "n_sig_probes": 0, "dmrs": []}),
                },
            )
            .collect();
        println!(
            "{}",
            json!({
                "regions": out,
                "diagnostic": {
                    "global_methylation": global_json,
                    "total_probes_analyzed": fit.all.len(),
                    "peak_memory_mb": (get_rss_mb() * 10.0).round() / 10.0,
                    "elapsed_ms": t0.elapsed().as_millis()
                }
            })
        );
        return;
    }

    let region = match call_region(&fit, &file, &ci, &ki, mvalues, qchr, qstart, qstop, &rp) {
        Some(r) => r,
        None => {
            println!(
                "{}",
                json!({"dmrs":[],"diagnostic":{"probes":{"positions":[],"mean_group1":[],"mean_group2":[],"fdr":[],"logFC":[]},"probe_spacings":[]}})
            );
            return;
        }
    };
    let RegionResult {
        rpos,
        rfdr,
        rlfc,
        mg1,
        mg2,
        sfdr: _sfdr,
        dmrs,
        n_sig_probes: _n_sig,
    } = region;

    // LOESS curves for both groups
    let n_eval = 200usize;
    let eval_pos: Vec<f64> = (0..n_eval)
        .map(|i| qstart as f64 + (qstop as f64 - qstart as f64) * i as f64 / (n_eval - 1) as f64)
        .collect();
    let loess_g1 = loess_fit(&rpos, &mg1, &eval_pos, 0.75);
    let loess_g2 = loess_fit(&rpos, &mg2, &eval_pos, 0.75);
    let loess_json = json!({
        "positions": eval_pos.iter().map(|&x| x.round() as i64).collect::<Vec<_>>(),
        "group1_fitted": loess_g1.as_ref().map_or(vec![], |l| l.0.clone()),
        "group1_ci_lower": loess_g1.as_ref().map_or(vec![], |l| l.1.clone()),
        "group1_ci_upper": loess_g1.as_ref().map_or(vec![], |l| l.2.clone()),
        "group2_fitted": loess_g2.as_ref().map_or(vec![], |l| l.0.clone()),
        "group2_ci_lower": loess_g2.as_ref().map_or(vec![], |l| l.1.clone()),
        "group2_ci_upper": loess_g2.as_ref().map_or(vec![], |l| l.2.clone()),
    });

    // Render the complete track as a transparent PNG
    let track_png = render_track_png(
        &rpos,
        &mg1,
        &mg2,
        &rfdr,
        &dmrs,
        &loess_g1,
        &loess_g2,
        &eval_pos,
        qstart as f64,
        qstop as f64,
        block_width,
        track_height,
        device_pixel_ratio,
        fdr_cut,
        max_loess_region,
        &render_colors,
    );

    let rss_peak = get_rss_mb();
    let elapsed_ms = t0.elapsed().as_millis();
    let r4 = |v: f64| -> Value {
        if v.is_finite() {
            json!((v * 10000.0).round() / 10000.0)
        } else {
            Value::Null
        }
    };
    let spacings: Vec<i64> = if rpos.len() > 1 {
        rpos.windows(2).map(|w| w[1] - w[0]).collect()
    } else {
        vec![]
    };
    println!(
        "{}",
        json!({
            "dmrs": dmrs,
            "diagnostic": { "probes": { "positions": rpos,
                "mean_group1": mg1.iter().map(|&v| r4(v)).collect::<Vec<_>>(),
                "mean_group2": mg2.iter().map(|&v| r4(v)).collect::<Vec<_>>(),
                "fdr": rfdr, "logFC": rlfc.iter().map(|&v| r4(v)).collect::<Vec<_>>() },
                "loess": loess_json,
                "probe_spacings": spacings,
                "global_methylation": global_json,
                "total_probes_analyzed": fit.all.len(),
                "peak_memory_mb": (rss_peak * 10.0).round() / 10.0,
                "start_memory_mb": (rss_start * 10.0).round() / 10.0,
                "elapsed_ms": elapsed_ms,
                "track_png": track_png }
        })
    );
}

#[cfg(test)]
mod tests {
    use super::select_significant;

    /// log FDRs standing in for a chromosome with no per-CpG significance: smoothing has pushed
    /// them all far below ln(0.05) = -3.0, which is exactly the situation that produced thousands
    /// of false DMRs when the cutoff was compared against the raw threshold.
    const SMOOTHED_BUT_UNSIGNIFICANT: [f64; 6] = [-9.0, -8.0, -7.5, -7.0, -6.0, -5.0];

    #[test]
    fn no_significant_probes_selects_nothing() {
        let out = select_significant(&SMOOTHED_BUT_UNSIGNIFICANT, 0);
        assert_eq!(out, vec![1.0; 6], "nsig == 0 must select no probes");
        assert!(
            SMOOTHED_BUT_UNSIGNIFICANT.iter().all(|&v| v < (0.05f64).ln()),
            "every value is under the raw cutoff -- the old code selected all six"
        );
    }

    #[test]
    fn selects_exactly_nsig_smallest() {
        let lf = [-1.0, -9.0, -3.0, -7.0, -2.0];
        let out = select_significant(&lf, 2);
        // the two smallest are -9.0 (idx 1) and -7.0 (idx 3)
        assert_eq!(out, vec![1.0, 0.0, 1.0, 0.0, 1.0]);
        assert_eq!(out.iter().filter(|&&v| v == 0.0).count(), 2);
    }

    #[test]
    fn ties_may_select_more_than_nsig() {
        // a tie at the cutoff admits both -- the threshold is a value, not a rank
        let out = select_significant(&[-5.0, -5.0, -1.0], 1);
        assert_eq!(out, vec![0.0, 0.0, 1.0]);
    }

    #[test]
    fn nsig_at_or_beyond_length_selects_all() {
        assert_eq!(select_significant(&[-4.0, -2.0], 2), vec![0.0, 0.0]);
        // nsig can never exceed the probe count, but must not panic if it does
        assert_eq!(select_significant(&[-4.0, -2.0], 9), vec![0.0, 0.0]);
    }

    #[test]
    fn empty_input_is_empty_output() {
        assert!(select_significant(&[], 0).is_empty());
    }
}
