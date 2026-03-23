// dmrcate.rs — Genome-wide empirical Bayes moderated t-test + DMRCate kernel smoothing
// Smyth 2004 (limma), Peters et al. 2015 (DMRCate), Phipson et al. 2016 (robust eBayes)
//
// Reads probe-level beta values from HDF5, runs chromosome-chunked OLS → genome-wide
// eBayes → regional kernel smoothing → DMR segmentation with proximity fallback.
// Usage: echo '{"probe_h5_file":"beta.h5","chr":"chr14","start":100000,"stop":105000,
//              "case":"s1,s2","control":"s3,s4"}' | target/release/dmrcate

use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use hdf5::File;
use hdf5::types::VarLenUnicode;
use serde_json::{Value, json};
use statrs::distribution::{ChiSquared, ContinuousCDF, StudentsT};
use statrs::function::gamma::digamma;
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

struct ProbeStats {
    chr: String,
    start: i64,
    probe_id: String,
    log_fc: f64,
    residual_var: f64,
    df_residual: f64,
}

fn read_h5_metadata(file: &File) -> Result<(Vec<String>, Vec<usize>, Vec<String>, Vec<i64>, Vec<String>), String> {
    let samples: Vec<String> = file
        .dataset("meta/samples/names")
        .map_err(|e| e.to_string())?
        .read_1d::<VarLenUnicode>()
        .map_err(|e| e.to_string())?
        .iter()
        .map(|s| s.to_string())
        .collect();
    let starts: Vec<i64> = file
        .dataset("meta/start")
        .map_err(|e| e.to_string())?
        .read_1d::<i64>()
        .map_err(|e| e.to_string())?
        .to_vec();
    let probes: Vec<String> = file
        .dataset("meta/probe/probeID")
        .map_err(|e| e.to_string())?
        .read_1d::<VarLenUnicode>()
        .map_err(|e| e.to_string())?
        .iter()
        .map(|s| s.to_string())
        .collect();
    let root = file.group("/").map_err(|e| e.to_string())?;
    let cl_json: String = root
        .attr("chrom_lengths")
        .map_err(|e| e.to_string())?
        .read_scalar::<VarLenUnicode>()
        .map_err(|e| e.to_string())?
        .to_string();
    // json crate preserves key order; serde_json::Map sorts alphabetically (wrong for chromosomes)
    let cl_parsed = json::parse(&cl_json).map_err(|e| format!("Failed to parse chrom_lengths: {}", e))?;
    let mut names = Vec::new();
    let mut lens = Vec::new();
    for (k, v) in cl_parsed.entries() {
        names.push(k.to_string());
        lens.push(v.as_u64().unwrap_or(0) as usize);
    }
    Ok((names, lens, samples, starts, probes))
}

fn process_chromosome(
    file: &File,
    row_start: usize,
    row_end: usize,
    case_idx: &[usize],
    ctrl_idx: &[usize],
    chr: &str,
    starts: &[i64],
    probe_ids: &[String],
    _min_spg: usize,
) -> Result<Vec<ProbeStats>, String> {
    let n_probes = row_end - row_start;
    if n_probes == 0 {
        return Ok(vec![]);
    }
    let ds = file.dataset("beta/values").map_err(|e| format!("beta/values: {}", e))?;
    let mut results = Vec::with_capacity(n_probes);
    const CHUNK: usize = 1000;
    for chunk_i in 0..((n_probes + CHUNK - 1) / CHUNK) {
        let cs = chunk_i * CHUNK;
        let ce = std::cmp::min(cs + CHUNK, n_probes);
        let sel = hdf5::Selection::from((row_start + cs..row_start + ce, ..));
        let data = ds
            .read_slice_2d::<f32, _>(sel)
            .map_err(|e| format!("HDF5 read: {}", e))?;
        for lp in 0..(ce - cs) {
            let row = data.row(lp);
            let (mut cv, mut kv) = (Vec::with_capacity(case_idx.len()), Vec::with_capacity(ctrl_idx.len()));
            for &si in case_idx {
                if si < row.len() {
                    let v = row[si] as f64;
                    if v.is_finite() {
                        cv.push(v);
                    }
                }
            }
            for &si in ctrl_idx {
                if si < row.len() {
                    let v = row[si] as f64;
                    if v.is_finite() {
                        kv.push(v);
                    }
                }
            }
            if cv.len() != case_idx.len() || kv.len() != ctrl_idx.len() {
                continue;
            }
            let to_m = |b: f64| {
                let c = b.clamp(0.001, 0.999);
                (c / (1.0 - c)).log2()
            };
            let cm: Vec<f64> = cv.iter().map(|&b| to_m(b)).collect();
            let km: Vec<f64> = kv.iter().map(|&b| to_m(b)).collect();
            let all: Vec<f64> = cm.iter().chain(km.iter()).copied().collect();
            let mean_all = all.iter().sum::<f64>() / all.len() as f64;
            let var = all.iter().map(|&x| (x - mean_all).powi(2)).sum::<f64>() / (all.len() as f64 - 1.0);
            if var <= 0.0 || !var.is_finite() {
                continue;
            }
            let (n1, n2) = (cm.len() as f64, km.len() as f64);
            let (mc, mk) = (cm.iter().sum::<f64>() / n1, km.iter().sum::<f64>() / n2);
            let ss: f64 =
                cm.iter().map(|&x| (x - mc).powi(2)).sum::<f64>() + km.iter().map(|&x| (x - mk).powi(2)).sum::<f64>();
            let df = n1 + n2 - 2.0;
            let rv = ss / df;
            if !rv.is_finite() || rv <= 0.0 {
                continue;
            }
            let idx = row_start + cs + lp;
            results.push(ProbeStats {
                chr: chr.to_string(),
                start: starts[idx],
                probe_id: probe_ids[idx].clone(),
                log_fc: mc - mk,
                residual_var: rv,
                df_residual: df,
            });
        }
    }
    Ok(results)
}

fn fit_f_dist(vars: &[f64], df: f64, debug_log: &str) -> (f64, f64) {
    if vars.len() < 3 {
        return (1.0, 0.0);
    }
    let z: Vec<f64> = vars.iter().map(|&v| v.ln()).collect();
    let mz = z.iter().sum::<f64>() / z.len() as f64;
    let vz = z.iter().map(|&zi| (zi - mz).powi(2)).sum::<f64>() / (z.len() as f64 - 1.0);
    let tri_df = trigamma(df / 2.0);
    let target = vz - tri_df;
    // Debug to file (stderr causes run_rust to error)
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(debug_log) {
        use std::io::Write;
        let _ = writeln!(
            f,
            "fit_f_dist: mean_z={:.6} var_z={:.6} trigamma(df/2)={:.6e} target={:.6}",
            mz, vz, tri_df, target
        );
    }
    let df0 = if target > 0.0 {
        2.0 * trigamma_inverse(target)
    } else {
        f64::INFINITY
    };
    let s20 = if df0.is_finite() {
        (mz - digamma(df / 2.0) + (df / 2.0).ln() + digamma(df0 / 2.0) - (df0 / 2.0).ln()).exp()
    } else {
        mz.exp()
    };
    (s20, df0)
}

fn kernel_smooth(pos: &[i64], t: &[f64], lambda: f64, c: f64) -> Vec<f64> {
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
        let p = if sk > 0.0 && skk > 0.0 {
            let (exp, var) = (sk, 2.0 * skk);
            let (b, a) = (2.0 * exp * exp / var, var / (2.0 * exp));
            if b > 0.0 && a > 0.0 {
                ChiSquared::new(b).map(|d| d.sf(sky / a)).unwrap_or(1.0)
            } else {
                1.0
            }
        } else {
            1.0
        };
        out.push(p);
    }
    out
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
) -> Vec<Value> {
    let n = pos.len();
    let sig: Vec<usize> = (0..n)
        .filter(|&i| {
            if fdr[i] >= cutoff {
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
        if (lfc[c] >= 0.0) == (lfc[p] >= 0.0) && (pos[c] - pos[p]) <= lambda as i64 {
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
    let debug_log = format!("{}/dmrcate_debug.log", dmrcate_dir);
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
    let (chr_names, chr_lens, sample_names, starts, probe_ids) = match read_h5_metadata(&file) {
        Ok(m) => m,
        Err(e) => bail!("{}", e),
    };
    let smap: HashMap<&str, usize> = sample_names.iter().enumerate().map(|(i, s)| (s.as_str(), i)).collect();
    let ci: Vec<usize> = cases.iter().filter_map(|s| smap.get(s).copied()).collect();
    let ki: Vec<usize> = ctrls.iter().filter_map(|s| smap.get(s).copied()).collect();
    if ci.len() < min_spg || ki.len() < min_spg {
        bail!("Not enough samples: case={}, control={}", ci.len(), ki.len());
    }
    let su = (1.0 / ci.len() as f64 + 1.0 / ki.len() as f64).sqrt();

    let mut all: Vec<ProbeStats> = Vec::new();
    let mut pfx = 0usize;
    for (i, &cl) in chr_lens.iter().enumerate() {
        if cl == 0 {
            pfx += cl;
            continue;
        }
        match process_chromosome(
            &file,
            pfx,
            pfx + cl,
            &ci,
            &ki,
            &chr_names[i],
            &starts,
            &probe_ids,
            min_spg,
        ) {
            Ok(s) => all.extend(s),
            Err(e) => {
                if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&debug_log) {
                    use std::io::Write;
                    let _ = writeln!(f, "Warning: {}: {}", chr_names[i], e);
                }
            }
        }
        pfx += cl;
    }
    if all.len() < 3 {
        bail!("Too few probes after filtering ({})", all.len());
    }

    let df = all[0].df_residual;
    let (s20, df0) = fit_f_dist(&all.iter().map(|s| s.residual_var).collect::<Vec<_>>(), df, &debug_log);
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&debug_log) {
        use std::io::Write;
        let _ = writeln!(
            f,
            "eBayes: s2_prior={:.6e} df_prior={:.4} df_residual={:.1} n_probes={}",
            s20,
            df0,
            df,
            all.len()
        );
    }
    let df_tot = df + df0;
    let tdist = StudentsT::new(0.0, 1.0, df_tot).unwrap_or_else(|_| StudentsT::new(0.0, 1.0, 100.0).unwrap());
    let mut mod_t = Vec::with_capacity(all.len());
    let mut raw_p = Vec::with_capacity(all.len());
    for s in &all {
        let s2p = if df0.is_finite() {
            (df0 * s20 + s.df_residual * s.residual_var) / (df0 + s.df_residual)
        } else {
            s.residual_var
        };
        let t = s.log_fc / (s2p.sqrt() * su);
        mod_t.push(t);
        raw_p.push(2.0 * tdist.sf(t.abs()));
    }
    let adj_p = bh_adjust(&raw_p);

    let ri: Vec<usize> = (0..all.len())
        .filter(|&i| all[i].chr == qchr && all[i].start >= qstart && all[i].start <= qstop)
        .collect();
    if ri.is_empty() {
        println!(
            "{}",
            json!({"dmrs":[],"diagnostic":{"probes":{"positions":[],"mean_group1":[],"mean_group2":[],"fdr":[],"logFC":[]},"probe_spacings":[]}})
        );
        return;
    }
    let rpos: Vec<i64> = ri.iter().map(|&i| all[i].start).collect();
    let rt: Vec<f64> = ri.iter().map(|&i| mod_t[i]).collect();
    let rfdr: Vec<f64> = ri.iter().map(|&i| adj_p[i]).collect();
    let rlfc: Vec<f64> = ri.iter().map(|&i| all[i].log_fc).collect();

    let (mut mg1, mut mg2) = (Vec::new(), Vec::new());
    let ds = file.dataset("beta/values").ok();
    for &idx in &ri {
        let pid = &all[idx].probe_id;
        if let (Some(abs), Some(ref d)) = (probe_ids.iter().position(|p| p == pid), &ds) {
            let sel = hdf5::Selection::from((abs..abs + 1, ..));
            if let Ok(r2d) = d.read_slice_2d::<f32, _>(sel) {
                let row = r2d.into_raw_vec_and_offset().0;
                let (mut cs, mut cc, mut ks, mut kc) = (0.0, 0, 0.0, 0);
                for &si in &ki {
                    if si < row.len() {
                        let v = row[si] as f64;
                        if v.is_finite() {
                            ks += v;
                            kc += 1;
                        }
                    }
                }
                for &si in &ci {
                    if si < row.len() {
                        let v = row[si] as f64;
                        if v.is_finite() {
                            cs += v;
                            cc += 1;
                        }
                    }
                }
                mg1.push(if kc > 0 { ks / kc as f64 } else { f64::NAN });
                mg2.push(if cc > 0 { cs / cc as f64 } else { f64::NAN });
                continue;
            }
        }
        mg1.push(f64::NAN);
        mg2.push(f64::NAN);
    }

    let smoothed_raw = kernel_smooth(&rpos, &rt, lambda, c_param);
    let sfdr = bh_adjust(&smoothed_raw);
    let mut dmrs = build_dmrs(qchr, &rpos, &rfdr, &rlfc, &mg1, &mg2, fdr_cut, lambda, 2, None);
    for dmr in &mut dmrs {
        if let (Some(s), Some(e)) = (dmr["start"].as_i64(), dmr["stop"].as_i64()) {
            let min_sfdr = rpos
                .iter()
                .zip(sfdr.iter())
                .filter(|(&p, _)| p >= s && p <= e)
                .map(|(_, &f)| f)
                .fold(f64::INFINITY, f64::min);
            dmr["min_smoothed_fdr"] = json!(min_sfdr);
        }
    }
    if dmrs.is_empty() {
        dmrs = build_dmrs(qchr, &rpos, &rfdr, &rlfc, &mg1, &mg2, fdr_cut, lambda, 2, Some(min_db));
    }

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
                "total_probes_analyzed": all.len(),
                "peak_memory_mb": (rss_peak * 10.0).round() / 10.0,
                "start_memory_mb": (rss_start * 10.0).round() / 10.0,
                "elapsed_ms": elapsed_ms,
                "track_png": track_png }
        })
    );
}
