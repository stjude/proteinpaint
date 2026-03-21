// dmrcate.rs — Full DMR analysis pipeline in Rust
//
// Replaces both probeLimma.R and dmrcate.R with a single binary that:
// 1. Reads probe-level beta values from HDF5 (chromosome-chunked, ~50MB peak)
// 2. Runs genome-wide limma-equivalent empirical Bayes moderated t-test
//    (Smyth 2004; Phipson et al. 2016)
// 3. Subsets to query region
// 4. Runs DMRCate kernel smoothing (Peters et al. 2015) via fused two-pointer
// 5. Applies proximity-based fallback for sparse regions
// 6. Outputs DMR calls + per-CpG diagnostic data as JSON
//
// Usage:
//   echo '{"probe_h5_file":"beta.h5","chr":"chr14","start":100000,"stop":105000,
//          "case":"s1,s2,s3","control":"s4,s5,s6"}' | target/release/dmrcate

use hdf5::File;
use hdf5::types::VarLenUnicode;
use serde_json::{Value, json};
use statrs::distribution::{ChiSquared, ContinuousCDF, StudentsT};
use statrs::function::gamma::digamma;
use std::collections::HashMap;
use std::io;

// ─── Special functions ───────────────────────────────────────────────────────

/// Trigamma function: ψ₁(x) = d²/dx² ln Γ(x)
/// Uses asymptotic series for large x, recursion for small x
fn trigamma(mut x: f64) -> f64 {
    if x <= 0.0 {
        return f64::NAN;
    }
    let mut result = 0.0;
    // Use recursion ψ₁(x) = ψ₁(x+1) + 1/x² to shift x into asymptotic range
    while x < 6.0 {
        result += 1.0 / (x * x);
        x += 1.0;
    }
    // Asymptotic expansion: ψ₁(x) ≈ 1/x + 1/(2x²) + 1/(6x³) - 1/(30x⁵) + ...
    let x2 = x * x;
    result += 1.0 / x + 1.0 / (2.0 * x2) + 1.0 / (6.0 * x2 * x) - 1.0 / (30.0 * x2 * x2 * x)
        + 1.0 / (42.0 * x2 * x2 * x2 * x);
    result
}

/// Inverse trigamma via Newton's method (matches limma's trigammaInverse)
fn trigamma_inverse(x: f64) -> f64 {
    if x.is_nan() || x <= 0.0 {
        return f64::NAN;
    }
    // Starting estimate
    let mut y = if x > 1e-6 { 1.0 / x.sqrt() } else { 1.0 / x };
    // Newton iterations
    for _ in 0..8 {
        let tri = trigamma(y);
        let dtri = -trigamma_deriv(y); // derivative of trigamma = -polygamma(2, x)
        let delta = (tri - x) / dtri;
        y -= delta;
        if y <= 0.0 {
            y = 0.5 * (y + delta); // pull back if we overshot
        }
        if delta.abs() < 1e-12 * y.abs() {
            break;
        }
    }
    y
}

/// Derivative of trigamma (= -polygamma(2, x))
/// Uses asymptotic series
fn trigamma_deriv(mut x: f64) -> f64 {
    let mut result = 0.0;
    while x < 6.0 {
        result -= 2.0 / (x * x * x);
        x += 1.0;
    }
    let x2 = x * x;
    result += -1.0 / x2 - 1.0 / (x2 * x) - 1.0 / (2.0 * x2 * x2) + 1.0 / (6.0 * x2 * x2 * x2);
    result
}

// ─── BH FDR correction ──────────────────────────────────────────────────────

fn bh_adjust(pvalues: &[f64]) -> Vec<f64> {
    let n = pvalues.len();
    if n == 0 {
        return vec![];
    }
    // Sort indices by p-value descending
    let mut indices: Vec<usize> = (0..n).collect();
    indices.sort_by(|&a, &b| pvalues[b].partial_cmp(&pvalues[a]).unwrap_or(std::cmp::Ordering::Equal));

    let mut adjusted = vec![0.0_f64; n];
    let mut cummin = f64::INFINITY;
    for (rank_from_end, &idx) in indices.iter().enumerate() {
        let rank = n - rank_from_end; // rank from 1 to n (descending order)
        let adj = pvalues[idx] * (n as f64) / (rank as f64);
        cummin = cummin.min(adj);
        adjusted[idx] = cummin.min(1.0);
    }
    adjusted
}

// ─── HDF5 reading helpers ────────────────────────────────────────────────────

struct H5ProbeData {
    chrom_names: Vec<String>,
    chrom_lengths: Vec<usize>,
    sample_names: Vec<String>,
    start_positions: Vec<i64>,
    probe_ids: Vec<String>,
}

fn read_h5_metadata(file: &File) -> Result<H5ProbeData, String> {
    let sample_names: Vec<String> = file
        .dataset("meta/samples/names")
        .map_err(|e| format!("Failed to read meta/samples/names: {}", e))?
        .read_1d::<VarLenUnicode>()
        .map_err(|e| format!("Failed to read sample names: {}", e))?
        .iter()
        .map(|s| s.to_string())
        .collect();

    let start_positions: Vec<i64> = file
        .dataset("meta/start")
        .map_err(|e| format!("Failed to read meta/start: {}", e))?
        .read_1d::<i64>()
        .map_err(|e| format!("Failed to read start positions: {}", e))?
        .to_vec();

    let probe_ids: Vec<String> = file
        .dataset("meta/probe/probeID")
        .map_err(|e| format!("Failed to read meta/probe/probeID: {}", e))?
        .read_1d::<VarLenUnicode>()
        .map_err(|e| format!("Failed to read probe IDs: {}", e))?
        .iter()
        .map(|s| s.to_string())
        .collect();

    // Read chrom_lengths from root attribute
    let root = file
        .group("/")
        .map_err(|e| format!("Failed to open root group: {}", e))?;
    let attr = root
        .attr("chrom_lengths")
        .map_err(|e| format!("Failed to read chrom_lengths attribute: {}", e))?;
    let chrom_json_str: String = attr
        .read_scalar::<VarLenUnicode>()
        .map_err(|e| format!("Failed to read chrom_lengths value: {}", e))?
        .to_string();

    let chrom_map: serde_json::Map<String, Value> =
        serde_json::from_str(&chrom_json_str).map_err(|e| format!("Failed to parse chrom_lengths JSON: {}", e))?;

    let mut chrom_names = Vec::new();
    let mut chrom_lengths = Vec::new();
    for (name, val) in &chrom_map {
        chrom_names.push(name.clone());
        chrom_lengths.push(val.as_u64().unwrap_or(0) as usize);
    }

    Ok(H5ProbeData {
        chrom_names,
        chrom_lengths,
        sample_names,
        start_positions,
        probe_ids,
    })
}

// ─── Per-probe OLS for two-group comparison ──────────────────────────────────

struct ProbeStats {
    chr: String,
    start: i64,
    probe_id: String,
    log_fc: f64,       // β̂ = mean(case) - mean(control)
    residual_var: f64, // s²
    df_residual: f64,  // n1 + n2 - 2
}

/// Read one chromosome's beta values from HDF5, convert to M-values, compute
/// per-probe OLS statistics. Returns ProbeStats for probes that pass filters.
fn process_chromosome(
    file: &File,
    row_start: usize,
    row_end: usize,
    case_indices: &[usize],
    control_indices: &[usize],
    chrom_name: &str,
    start_positions: &[i64],
    probe_ids: &[String],
    min_samples_per_group: usize,
) -> Result<Vec<ProbeStats>, String> {
    let n_probes = row_end - row_start;
    if n_probes == 0 {
        return Ok(vec![]);
    }

    let n_cases = case_indices.len();
    let n_controls = control_indices.len();
    let all_indices: Vec<usize> = case_indices.iter().chain(control_indices.iter()).copied().collect();
    let _n_samples = all_indices.len();

    // Read beta values: HDF5 shape is (n_samples_total, n_probes_total)
    // We read a slice: selected sample columns × this chromosome's rows
    let dataset = file
        .dataset("beta/values")
        .map_err(|e| format!("Failed to open beta/values: {}", e))?;

    let mut results = Vec::with_capacity(n_probes);

    // Process probes one at a time to minimize memory
    // Actually, read the whole chromosome slice for efficiency (still bounded ~200MB)
    let shape = dataset.shape();
    let _n_total_probes = shape[0];
    let _n_total_samples = shape[1];

    // Read chromosome in chunks of CHUNK_SIZE rows (~6MB per chunk) to balance
    // HDF5 call overhead vs memory usage. One read per row was ~1M calls = ~8s.
    const CHUNK_SIZE: usize = 1000;
    let n_chunks = (n_probes + CHUNK_SIZE - 1) / CHUNK_SIZE;

    for chunk_idx in 0..n_chunks {
        let chunk_start = chunk_idx * CHUNK_SIZE;
        let chunk_end = std::cmp::min(chunk_start + CHUNK_SIZE, n_probes);
        let abs_start = row_start + chunk_start;
        let abs_end = row_start + chunk_end;

        // Read chunk: shape (chunk_len, n_total_samples)
        let sel = hdf5::Selection::from((abs_start..abs_end, ..));
        let chunk_data = dataset
            .read_slice_2d::<f32, _>(sel)
            .map_err(|e| format!("HDF5 read error: {}", e))?;

        for local_p in 0..(chunk_end - chunk_start) {
            let p = chunk_start + local_p;
            let row = chunk_data.row(local_p);

            let mut case_vals: Vec<f64> = Vec::with_capacity(n_cases);
            let mut ctrl_vals: Vec<f64> = Vec::with_capacity(n_controls);

            for &si in case_indices {
                if si >= row.len() {
                    continue;
                }
                let v = row[si] as f64;
                if v.is_finite() {
                    case_vals.push(v);
                }
            }
            for &si in control_indices {
                if si >= row.len() {
                    continue;
                }
                let v = row[si] as f64;
                if v.is_finite() {
                    ctrl_vals.push(v);
                }
            }

            // Filter: min samples per group
            if case_vals.len() < min_samples_per_group || ctrl_vals.len() < min_samples_per_group {
                continue;
            }

            // Convert beta to M-values: M = log2(beta / (1 - beta))
            let to_mval = |b: f64| -> f64 {
                let b_clamped = b.clamp(0.001, 0.999);
                (b_clamped / (1.0 - b_clamped)).log2()
            };
            let case_m: Vec<f64> = case_vals.iter().map(|&b| to_mval(b)).collect();
            let ctrl_m: Vec<f64> = ctrl_vals.iter().map(|&b| to_mval(b)).collect();

            // Check for zero variance
            let all_m: Vec<f64> = case_m.iter().chain(ctrl_m.iter()).copied().collect();
            let mean_all = all_m.iter().sum::<f64>() / all_m.len() as f64;
            let var_all = all_m.iter().map(|&x| (x - mean_all).powi(2)).sum::<f64>() / (all_m.len() as f64 - 1.0);
            if var_all <= 0.0 || !var_all.is_finite() {
                continue;
            }

            // Per-probe OLS for two groups
            let n1 = case_m.len() as f64;
            let n2 = ctrl_m.len() as f64;
            let mean_case = case_m.iter().sum::<f64>() / n1;
            let mean_ctrl = ctrl_m.iter().sum::<f64>() / n2;
            let log_fc = mean_case - mean_ctrl; // case - control

            // Pooled residual variance
            let ss_case: f64 = case_m.iter().map(|&x| (x - mean_case).powi(2)).sum();
            let ss_ctrl: f64 = ctrl_m.iter().map(|&x| (x - mean_ctrl).powi(2)).sum();
            let df = n1 + n2 - 2.0;
            let residual_var = (ss_case + ss_ctrl) / df;

            if !residual_var.is_finite() || residual_var <= 0.0 {
                continue;
            }

            let abs_probe_idx = row_start + p;
            results.push(ProbeStats {
                chr: chrom_name.to_string(),
                start: start_positions[abs_probe_idx],
                probe_id: probe_ids[abs_probe_idx].clone(),
                log_fc,
                residual_var,
                df_residual: df,
            });
        } // end for local_p
    } // end for chunk_idx

    Ok(results)
}

// ─── Empirical Bayes (fitFDist equivalent) ───────────────────────────────────

struct EBayesPrior {
    s2_prior: f64, // s₀²
    df_prior: f64, // d₀
}

fn fit_f_dist(variances: &[f64], df: f64) -> EBayesPrior {
    let n = variances.len();
    if n < 3 {
        return EBayesPrior {
            s2_prior: 1.0,
            df_prior: 0.0,
        };
    }

    // z = log(s²)
    let z: Vec<f64> = variances.iter().map(|&v| v.ln()).collect();
    let mean_z = z.iter().sum::<f64>() / n as f64;
    let var_z = z.iter().map(|&zi| (zi - mean_z).powi(2)).sum::<f64>() / (n as f64 - 1.0);

    // Solve: trigamma(d₀/2) = var_z - trigamma(df/2)
    let target = var_z - trigamma(df / 2.0);
    let df_prior = if target > 0.0 {
        2.0 * trigamma_inverse(target)
    } else {
        // If target <= 0, the data doesn't support shrinkage; use large df_prior
        f64::INFINITY
    };

    // log(s₀²) = mean_z - digamma(df/2) + log(df/2) + digamma(d₀/2) - log(d₀/2)
    let log_s2_prior = if df_prior.is_finite() {
        mean_z - digamma(df / 2.0) + (df / 2.0).ln() + digamma(df_prior / 2.0) - (df_prior / 2.0).ln()
    } else {
        mean_z
    };
    let s2_prior = log_s2_prior.exp();

    EBayesPrior { s2_prior, df_prior }
}

// ─── Kernel smoothing (DMRCate equivalent) ───────────────────────────────────

struct SmoothedResult {
    smoothed_pval: f64,
}

fn kernel_smooth_region(positions: &[i64], t_stats: &[f64], lambda: f64, c_param: f64) -> Vec<SmoothedResult> {
    let n = positions.len();
    let sigma = lambda / c_param;
    let max_support = (5.0 * sigma) as i64;
    let two_sigma_sq = 2.0 * sigma * sigma;

    let mut results = Vec::with_capacity(n);

    let mut left = 0usize;
    let mut right = 0usize;

    for i in 0..n {
        // Expand window
        while right < n && (positions[right] - positions[i]).abs() <= max_support {
            right += 1;
        }
        // Shrink window from left
        while left < n && positions[i] - positions[left] > max_support {
            left += 1;
        }

        let mut sky = 0.0_f64; // Σ w * t²
        let mut sk = 0.0_f64; // Σ w
        let mut skk = 0.0_f64; // Σ w²

        for j in left..right {
            let dx = (positions[i] - positions[j]) as f64;
            let w = (-dx * dx / two_sigma_sq).exp();
            sky += w * t_stats[j] * t_stats[j];
            sk += w;
            skk += w * w;
        }

        // Satterthwaite approximation: S ~ a * χ²(b)
        let smoothed_pval = if sk > 0.0 && skk > 0.0 {
            let expected = sk;
            let variance = 2.0 * skk;
            let b = 2.0 * expected * expected / variance; // Satterthwaite df
            let a = variance / (2.0 * expected); // Satterthwaite scale

            if b > 0.0 && a > 0.0 {
                match ChiSquared::new(b) {
                    Ok(chi2) => 1.0 - chi2.cdf(sky / a),
                    Err(_) => 1.0,
                }
            } else {
                1.0
            }
        } else {
            1.0
        };

        results.push(SmoothedResult { smoothed_pval });
    }

    results
}

// ─── DMR segmentation ───────────────────────────────────────────────────────

fn segment_dmrs(
    chr: &str,
    positions: &[i64],
    smoothed_fdr: &[f64],
    log_fcs: &[f64],
    mean_group1: &[f64],
    mean_group2: &[f64],
    fdr_cutoff: f64,
    lambda: f64,
    min_cpgs: usize,
) -> Vec<Value> {
    let n = positions.len();
    let mut dmrs: Vec<Value> = Vec::new();

    // Group consecutive significant probes within lambda bp
    let mut i = 0;
    while i < n {
        if smoothed_fdr[i] >= fdr_cutoff {
            i += 1;
            continue;
        }
        // Start a new region
        let region_start = i;
        let mut region_end = i;
        while region_end + 1 < n
            && smoothed_fdr[region_end + 1] < fdr_cutoff
            && (positions[region_end + 1] - positions[region_end]) <= lambda as i64
        {
            region_end += 1;
        }

        let no_cpgs = region_end - region_start + 1;
        if no_cpgs >= min_cpgs {
            let region_fdrs: Vec<f64> = (region_start..=region_end).map(|j| smoothed_fdr[j]).collect();
            let _region_lfc: Vec<f64> = (region_start..=region_end).map(|j| log_fcs[j]).collect();
            let region_deltas: Vec<f64> = (region_start..=region_end)
                .map(|j| mean_group2[j] - mean_group1[j])
                .collect();

            let min_fdr = region_fdrs.iter().cloned().fold(f64::INFINITY, f64::min);
            let hmfdr = region_fdrs.len() as f64 / region_fdrs.iter().map(|&f| 1.0 / f.max(1e-300)).sum::<f64>();
            let meandiff: f64 = region_deltas.iter().sum::<f64>() / region_deltas.len() as f64;
            let maxdiff = if meandiff >= 0.0 {
                region_deltas.iter().cloned().fold(f64::NEG_INFINITY, f64::max)
            } else {
                region_deltas.iter().cloned().fold(f64::INFINITY, f64::min)
            };
            let direction = if meandiff >= 0.0 { "hyper" } else { "hypo" };

            dmrs.push(json!({
                "chr": chr,
                "start": positions[region_start],
                "stop": positions[region_end],
                "no_cpgs": no_cpgs,
                "min_smoothed_fdr": min_fdr,
                "HMFDR": hmfdr,
                "maxdiff": maxdiff,
                "meandiff": meandiff,
                "direction": direction,
                "overlapping_genes": null
            }));
        }

        i = region_end + 1;
    }

    dmrs
}

// ─── Proximity-based fallback ────────────────────────────────────────────────

fn proximity_fallback(
    chr: &str,
    positions: &[i64],
    fdr: &[f64],
    log_fcs: &[f64],
    mean_group1: &[f64],
    mean_group2: &[f64],
    fdr_cutoff: f64,
    min_delta_beta: f64,
    lambda: f64,
) -> Vec<Value> {
    let n = positions.len();
    let mut dmrs: Vec<Value> = Vec::new();

    // Find significant probes (FDR + delta-beta)
    let mut sig_indices: Vec<usize> = Vec::new();
    for i in 0..n {
        if fdr[i] < fdr_cutoff {
            let delta = mean_group2[i] - mean_group1[i];
            if delta.abs() >= min_delta_beta {
                sig_indices.push(i);
            }
        }
    }

    if sig_indices.len() < 2 {
        return dmrs;
    }

    // Group by proximity + same direction
    let mut groups: Vec<Vec<usize>> = Vec::new();
    let mut current_group = vec![sig_indices[0]];
    for k in 1..sig_indices.len() {
        let prev = *current_group.last().unwrap();
        let curr = sig_indices[k];
        let same_dir = (log_fcs[curr] >= 0.0) == (log_fcs[prev] >= 0.0);
        let close = (positions[curr] - positions[prev]) <= lambda as i64;
        if same_dir && close {
            current_group.push(curr);
        } else {
            groups.push(current_group);
            current_group = vec![curr];
        }
    }
    groups.push(current_group);

    for grp in &groups {
        if grp.len() < 2 {
            continue;
        }
        let grp_deltas: Vec<f64> = grp.iter().map(|&j| mean_group2[j] - mean_group1[j]).collect();
        let grp_fdrs: Vec<f64> = grp.iter().map(|&j| fdr[j]).collect();
        let meandiff = grp_deltas.iter().sum::<f64>() / grp_deltas.len() as f64;
        let maxdiff = if meandiff >= 0.0 {
            grp_deltas.iter().cloned().fold(f64::NEG_INFINITY, f64::max)
        } else {
            grp_deltas.iter().cloned().fold(f64::INFINITY, f64::min)
        };
        let min_fdr = grp_fdrs.iter().cloned().fold(f64::INFINITY, f64::min);
        let hmfdr = grp_fdrs.len() as f64 / grp_fdrs.iter().map(|&f| 1.0 / f.max(1e-300)).sum::<f64>();

        dmrs.push(json!({
            "chr": chr,
            "start": positions[*grp.first().unwrap()],
            "stop": positions[*grp.last().unwrap()],
            "no_cpgs": grp.len(),
            "min_smoothed_fdr": min_fdr,
            "HMFDR": hmfdr,
            "maxdiff": maxdiff,
            "meandiff": meandiff,
            "direction": if meandiff >= 0.0 { "hyper" } else { "hypo" },
            "overlapping_genes": null
        }));
    }

    dmrs
}

// ─── Main ────────────────────────────────────────────────────────────────────

fn main() {
    let mut input = String::new();
    if io::stdin().read_line(&mut input).is_err() {
        println!("{}", json!({"error": "Failed to read stdin"}));
        return;
    }

    let params: Value = match serde_json::from_str(&input) {
        Ok(v) => v,
        Err(e) => {
            println!("{}", json!({"error": format!("Invalid JSON: {}", e)}));
            return;
        }
    };

    let h5_file = params["probe_h5_file"].as_str().unwrap_or("");
    let query_chr = params["chr"].as_str().unwrap_or("");
    let query_start = params["start"].as_i64().unwrap_or(0);
    let query_stop = params["stop"].as_i64().unwrap_or(0);
    let case_str = params["case"].as_str().unwrap_or("");
    let control_str = params["control"].as_str().unwrap_or("");
    let fdr_cutoff = params["fdr_cutoff"].as_f64().unwrap_or(0.05);
    let lambda = params["lambda"].as_f64().unwrap_or(1000.0);
    let c_param = params["C"].as_f64().unwrap_or(2.0);
    let min_delta_beta = params["min_delta_beta"].as_f64().unwrap_or(0.05);
    let min_spg = params["min_samples_per_group"].as_u64().unwrap_or(3) as usize;

    let cases: Vec<&str> = case_str.split(',').filter(|s| !s.is_empty()).collect();
    let controls: Vec<&str> = control_str.split(',').filter(|s| !s.is_empty()).collect();

    if h5_file.is_empty() || query_chr.is_empty() || cases.is_empty() || controls.is_empty() {
        println!("{}", json!({"error": "Missing required parameters"}));
        return;
    }

    // Open HDF5 file
    let file = match File::open(h5_file) {
        Ok(f) => f,
        Err(e) => {
            println!("{}", json!({"error": format!("Failed to open HDF5: {}", e)}));
            return;
        }
    };

    let metadata = match read_h5_metadata(&file) {
        Ok(m) => m,
        Err(e) => {
            println!("{}", json!({"error": e}));
            return;
        }
    };

    // Map sample names to indices
    let sample_map: HashMap<&str, usize> = metadata
        .sample_names
        .iter()
        .enumerate()
        .map(|(i, s)| (s.as_str(), i))
        .collect();

    let case_indices: Vec<usize> = cases.iter().filter_map(|s| sample_map.get(s).copied()).collect();
    let control_indices: Vec<usize> = controls.iter().filter_map(|s| sample_map.get(s).copied()).collect();

    if case_indices.len() < min_spg || control_indices.len() < min_spg {
        println!(
            "{}",
            json!({"error": format!(
                "Not enough samples: case={}, control={}, need {} each",
                case_indices.len(), control_indices.len(), min_spg
            )})
        );
        return;
    }

    let n_cases = case_indices.len();
    let n_controls = control_indices.len();
    let stdev_unscaled = (1.0 / n_cases as f64 + 1.0 / n_controls as f64).sqrt();

    // ── Phase 1: Chromosome-chunked per-probe OLS ──────────────────────────
    let mut all_stats: Vec<ProbeStats> = Vec::new();
    let mut prefix = 0usize;

    for (ci, chrom_len) in metadata.chrom_lengths.iter().enumerate() {
        let row_start = prefix;
        let row_end = prefix + chrom_len;
        prefix = row_end;

        if *chrom_len == 0 {
            continue;
        }

        match process_chromosome(
            &file,
            row_start,
            row_end,
            &case_indices,
            &control_indices,
            &metadata.chrom_names[ci],
            &metadata.start_positions,
            &metadata.probe_ids,
            min_spg,
        ) {
            Ok(stats) => all_stats.extend(stats),
            Err(e) => {
                eprintln!("Warning: failed to process {}: {}", metadata.chrom_names[ci], e);
            }
        }
    }

    if all_stats.len() < 3 {
        println!(
            "{}",
            json!({"error": format!(
                "Too few probes genome-wide after filtering ({})", all_stats.len()
            )})
        );
        return;
    }

    // ── Phase 2: Empirical Bayes ────────────────────────────────────────────
    let df = all_stats[0].df_residual; // same for all probes in two-group
    let variances: Vec<f64> = all_stats.iter().map(|s| s.residual_var).collect();
    let prior = fit_f_dist(&variances, df);

    // Compute moderated t-stats and p-values
    let df_total = df + prior.df_prior;
    let t_dist = StudentsT::new(0.0, 1.0, df_total).unwrap_or_else(|_| StudentsT::new(0.0, 1.0, 100.0).unwrap());

    let mut mod_t: Vec<f64> = Vec::with_capacity(all_stats.len());
    let mut raw_p: Vec<f64> = Vec::with_capacity(all_stats.len());

    for stat in &all_stats {
        let s2_post = if prior.df_prior.is_finite() {
            (prior.df_prior * prior.s2_prior + stat.df_residual * stat.residual_var)
                / (prior.df_prior + stat.df_residual)
        } else {
            stat.residual_var
        };
        let t = stat.log_fc / (s2_post.sqrt() * stdev_unscaled);
        let p = 2.0 * (1.0 - t_dist.cdf(t.abs()));
        mod_t.push(t);
        raw_p.push(p);
    }

    // Genome-wide BH FDR
    let adj_p = bh_adjust(&raw_p);

    // ── Phase 3: Subset to query region ─────────────────────────────────────
    let mut region_indices: Vec<usize> = Vec::new();
    for (i, stat) in all_stats.iter().enumerate() {
        if stat.chr == query_chr && stat.start >= query_start && stat.start <= query_stop {
            region_indices.push(i);
        }
    }

    if region_indices.is_empty() {
        println!(
            "{}",
            json!({
                "dmrs": [],
                "diagnostic": {
                    "probes": {"positions": [], "mean_group1": [], "mean_group2": [], "fdr": [], "logFC": []},
                    "probe_spacings": []
                }
            })
        );
        return;
    }

    // ── Read beta values for diagnostic group means ─────────────────────────
    let region_positions: Vec<i64> = region_indices.iter().map(|&i| all_stats[i].start).collect();
    let region_t: Vec<f64> = region_indices.iter().map(|&i| mod_t[i]).collect();
    let region_fdr: Vec<f64> = region_indices.iter().map(|&i| adj_p[i]).collect();
    let region_lfc: Vec<f64> = region_indices.iter().map(|&i| all_stats[i].log_fc).collect();

    // Compute group means from beta values (re-read from HDF5 for the region)
    let mut mean_g1: Vec<f64> = Vec::new();
    let mut mean_g2: Vec<f64> = Vec::new();

    // Find absolute probe indices for the region
    // We need to map back to HDF5 row indices
    let dataset = file.dataset("beta/values").ok();
    for &ri in &region_indices {
        let probe_id = &all_stats[ri].probe_id;
        // Find this probe's absolute index in the HDF5
        if let Some(abs_idx) = metadata.probe_ids.iter().position(|p| p == probe_id) {
            let mut case_sum = 0.0;
            let mut case_count = 0;
            let mut ctrl_sum = 0.0;
            let mut ctrl_count = 0;

            if let Some(ref ds) = dataset {
                // Read full row for this probe
                let diag_sel = hdf5::Selection::from((abs_idx..abs_idx + 1, ..));
                if let Ok(row_2d) = ds.read_slice_2d::<f32, _>(diag_sel) {
                    let row = row_2d.into_raw_vec_and_offset().0;
                    for &si in &control_indices {
                        if si < row.len() {
                            let v = row[si] as f64;
                            if v.is_finite() {
                                ctrl_sum += v;
                                ctrl_count += 1;
                            }
                        }
                    }
                    for &si in &case_indices {
                        if si < row.len() {
                            let v = row[si] as f64;
                            if v.is_finite() {
                                case_sum += v;
                                case_count += 1;
                            }
                        }
                    }
                }
            }

            mean_g1.push(if ctrl_count > 0 {
                ctrl_sum / ctrl_count as f64
            } else {
                f64::NAN
            });
            mean_g2.push(if case_count > 0 {
                case_sum / case_count as f64
            } else {
                f64::NAN
            });
        } else {
            mean_g1.push(f64::NAN);
            mean_g2.push(f64::NAN);
        }
    }

    // ── Phase 4: Kernel smoothing on query region ───────────────────────────
    let smoothed = kernel_smooth_region(&region_positions, &region_t, lambda, c_param);
    let smoothed_pvals: Vec<f64> = smoothed.iter().map(|s| s.smoothed_pval).collect();
    let smoothed_fdr = bh_adjust(&smoothed_pvals);

    // ── Phase 5: Segment into DMRs ──────────────────────────────────────────
    let mut dmrs = segment_dmrs(
        query_chr,
        &region_positions,
        &smoothed_fdr,
        &region_lfc,
        &mean_g1,
        &mean_g2,
        fdr_cutoff,
        lambda,
        2,
    );

    // Fallback if no DMRs found
    if dmrs.is_empty() {
        dmrs = proximity_fallback(
            query_chr,
            &region_positions,
            &region_fdr,
            &region_lfc,
            &mean_g1,
            &mean_g2,
            fdr_cutoff,
            min_delta_beta,
            lambda,
        );
    }

    // ── Phase 6: Build diagnostic output ────────────────────────────────────
    let probe_spacings: Vec<i64> = if region_positions.len() > 1 {
        region_positions.windows(2).map(|w| w[1] - w[0]).collect()
    } else {
        vec![]
    };

    let round4 = |v: f64| -> Value {
        if v.is_finite() {
            json!((v * 10000.0).round() / 10000.0)
        } else {
            Value::Null
        }
    };

    let output = json!({
        "dmrs": dmrs,
        "diagnostic": {
            "probes": {
                "positions": region_positions,
                "mean_group1": mean_g1.iter().map(|&v| round4(v)).collect::<Vec<Value>>(),
                "mean_group2": mean_g2.iter().map(|&v| round4(v)).collect::<Vec<Value>>(),
                "fdr": region_fdr,
                "logFC": region_lfc.iter().map(|&v| round4(v)).collect::<Vec<Value>>(),
            },
            "probe_spacings": probe_spacings,
        }
    });

    println!("{}", output);
}
