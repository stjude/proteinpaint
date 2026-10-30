// dmrcate.rs — DMRcate, ported to follow the Bioconductor package step for step:
// sequencing.annotate() (or cpg.annotate() for M-values), then dmrcate().
// Peters et al. 2015, Epigenetics & Chromatin 8:6; Peters et al. 2021, Nucleic Acids Research 49:e109.
//
// One invocation is one DMRcate run over every chromosome it is given. That is what makes the
// genome-wide steps genome-wide: the empirical Bayes prior, the per-CpG BH correction, the BH
// correction of the kernel-smoothed p-values, and the adaptive cutoff that keeps as many smoothed
// CpGs as there are individually significant ones. Run per chromosome, all four change.
//
// Three modes, by input (every mode takes "matrices": [{file, chrs}], "case", "control"):
//   scan        + "windows": the run, reporting the DMRs that overlap each window, the constants a
//               region view needs, the genome-wide profile ("bin_bp") and the global level.
//   region      + "region", "constants", "dmrs": one region of a run already made, recomputed
//               locally from the run's constants, so every CpG reads exactly as it did in the run.
//   background  + "background_regions": mean delta-beta per window, no model.
//
// A matrix holds betas with read depth per cell (a WGBS CpG matrix), M-values ("mvalues": true, an
// element matrix), or betas alone ("betas": true, an array's CpG matrix or an element matrix of
// betas). See read_rows for what each contributes.

use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use hdf5::File;
use hdf5::types::VarLenUnicode;
use serde::Serialize;
use serde_json::{Value, json};
use statrs::distribution::{ContinuousCDF, Normal, StudentsT};
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

/// User + system CPU seconds consumed so far, from getrusage. Compared with wall time this says
/// how much of the run was compute versus waiting on the HDF5 read.
fn get_cpu_seconds() -> f64 {
    unsafe {
        let mut usage: libc::rusage = std::mem::zeroed();
        libc::getrusage(libc::RUSAGE_SELF, &mut usage);
        let tv = |t: libc::timeval| t.tv_sec as f64 + t.tv_usec as f64 / 1e6;
        tv(usage.ru_utime) + tv(usage.ru_stime)
    }
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
    let (chr_names, chr_rows) = read_chroms(file)?;
    Ok(H5Meta {
        chr_names,
        chr_rows,
        samples,
        starts,
    })
}

/// The chromosomes of a matrix in row order, with the rows each occupies.
fn read_chroms(file: &File) -> Result<(Vec<String>, Vec<usize>), String> {
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
    Ok((chr_names, chr_rows))
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

/// Single-threaded. Reading two matrix files at once saved under a tenth of the wall time -- HDF5
/// serialises its calls behind one lock -- and cost a second copy of the genome while the two were
/// joined. Reported so a deployment reading the diagnostic knows a run costs one core.
const THREADS: usize = 1;

/// trigamma to double precision: recurrence up to 10, then the asymptotic series through x^-11,
/// whose next term is below 3e-14 there. limma's prior df rests on it, through trigammaInverse.
fn trigamma(mut x: f64) -> f64 {
    if x <= 0.0 {
        return f64::NAN;
    }
    let mut r = 0.0;
    while x < 10.0 {
        r += 1.0 / (x * x);
        x += 1.0;
    }
    let x2 = x * x;
    let s = 1.0 / x2;
    r + 1.0 / x
        + s / 2.0
        + s / x * (1.0 / 6.0 - s * (1.0 / 30.0 - s * (1.0 / 42.0 - s * (1.0 / 30.0 - s * 5.0 / 66.0))))
}

fn trigamma_deriv(mut x: f64) -> f64 {
    let mut r = 0.0;
    while x < 10.0 {
        r -= 2.0 / (x * x * x);
        x += 1.0;
    }
    let s = 1.0 / (x * x);
    // d/dx of the series above
    r - s - s / x - s * s / 2.0 + s * s * s / 6.0 - s * s * s * s * 3.0 / 10.0 + s * s * s * s * s * 5.0 / 6.0
}

/// limma's trigammaInverse: the same starting point, Newton step and stopping rule.
fn trigamma_inverse(x: f64) -> f64 {
    if x.is_nan() || x <= 0.0 {
        return f64::NAN;
    }
    if x > 1e7 {
        return 1.0 / x.sqrt();
    }
    if x < 1e-6 {
        return 1.0 / x;
    }
    let mut y = 0.5 + 1.0 / x;
    for _ in 0..50 {
        let tri = trigamma(y);
        let dif = tri * (1.0 - tri / x) / trigamma_deriv(y);
        y += dif;
        if -dif / y < 1e-8 {
            break;
        }
    }
    y
}

/// R's p.adjust(p, "BH"). A NaN is dropped before n is counted -- p.adjust's default n is
/// length(p), evaluated after the NAs are removed -- and comes back NaN.
fn bh_adjust(p: &[f64]) -> Vec<f64> {
    bh_adjust_ordered(p).0
}

/// bh_adjust, plus the non-NaN indices in descending order of p -- which is also ascending order
/// of the adjusted values read from the end, since BH is monotone in p.
fn bh_adjust_ordered(p: &[f64]) -> (Vec<f64>, Vec<u32>) {
    let mut idx: Vec<u32> = (0..p.len() as u32).filter(|&i| !p[i as usize].is_nan()).collect();
    // largest first; tied values all receive the same adjusted value, so their order is immaterial
    idx.sort_unstable_by(|&a, &b| p[b as usize].partial_cmp(&p[a as usize]).unwrap());
    let n = idx.len() as f64;
    let mut out = vec![f64::NAN; p.len()];
    let mut cm = f64::INFINITY;
    for (k, &i) in idx.iter().enumerate() {
        let rank = (idx.len() - k) as f64;
        cm = cm.min(n / rank * p[i as usize]);
        out[i as usize] = cm.min(1.0);
    }
    (out, idx)
}

/// R's qnorm (Wichura's AS241), lower tail.
fn qnorm(p: f64) -> f64 {
    if p.is_nan() {
        return f64::NAN;
    }
    if p <= 0.0 {
        return f64::NEG_INFINITY;
    }
    if p >= 1.0 {
        return f64::INFINITY;
    }
    let q = p - 0.5;
    if q.abs() <= 0.425 {
        let r = 0.180625 - q * q;
        return q
            * (((((((r * 2509.0809287301226727 + 33430.575583588128105) * r + 67265.770927008700853) * r
                + 45921.953931549871457)
                * r
                + 13731.693765509461125)
                * r
                + 1971.5909503065514427)
                * r
                + 133.14166789178437745)
                * r
                + 3.387132872796366608)
            / (((((((r * 5226.495278852545925 + 28729.085735721942674) * r + 39307.89580009271061) * r
                + 21213.794301586595867)
                * r
                + 5394.1960214247511077)
                * r
                + 687.1870074920579083)
                * r
                + 42.313330701600911252)
                * r
                + 1.0);
    }
    let mut r = (-(if q < 0.0 { p } else { 1.0 - p }).ln()).sqrt();
    let val = if r <= 5.0 {
        r -= 1.6;
        (((((((r * 7.7454501427834140764e-4 + 0.0227238449892691845833) * r + 0.24178072517745061177) * r
            + 1.27045825245236838258)
            * r
            + 3.64784832476320460504)
            * r
            + 5.7694972214606914055)
            * r
            + 4.6303378461565452959)
            * r
            + 1.42343711074968357734)
            / (((((((r * 1.05075007164441684324e-9 + 5.475938084995344946e-4) * r + 0.0151986665636164571966) * r
                + 0.14810397642748007459)
                * r
                + 0.68976733498510000455)
                * r
                + 1.6763848301838038494)
                * r
                + 2.05319162663775882187)
                * r
                + 1.0)
    } else {
        r -= 5.0;
        (((((((r * 2.01033439929228813265e-7 + 2.71155556874348757815e-5) * r + 0.0012426609473880784386) * r
            + 0.026532189526576123093)
            * r
            + 0.29656057182850489123)
            * r
            + 1.7848265399172913358)
            * r
            + 5.4637849111641143699)
            * r
            + 6.6579046435011037772)
            / (((((((r * 2.04426310338993978564e-15 + 1.4215117583164458887e-7) * r + 1.8463183175100546818e-5) * r
                + 7.868691311456132591e-4)
                * r
                + 0.0148753612908506148525)
                * r
                + 0.13692988092273580531)
                * r
                + 0.59983220655588793769)
                * r
                + 1.0)
    };
    if q < 0.0 { -val } else { val }
}

fn std_normal() -> Normal {
    Normal::new(0.0, 1.0).unwrap()
}

/// Upper tail of Student's t at t >= 0, as R's pt(-t, df) computes it -- including R's switch to
/// a normal approximation above 4e5 degrees of freedom, which is where a run whose prior df is
/// infinite lands (the moderated df is then the pooled residual df).
fn pt_upper(t: f64, df: f64) -> f64 {
    if df > 4e5 {
        let v = 1.0 / (4.0 * df);
        return std_normal().sf(t * (1.0 - v) / (1.0 + t * t * 2.0 * v).sqrt());
    }
    StudentsT::new(0.0, 1.0, df).map(|d| d.sf(t)).unwrap_or(f64::NAN)
}

/// R's pchisq(x, df, lower.tail = FALSE), on the linear scale as DMRcate computes it.
fn chisq_sf(x: f64, df: f64) -> f64 {
    if x == f64::INFINITY {
        return 0.0;
    }
    log_chisq_sf(x, df).exp()
}

/// limma's fitFDist without a covariate: the moment estimate of the prior's scale and df.
#[cfg(test)]
fn fit_f_dist(x: &[f64], df1: &[f64]) -> (f64, f64) {
    fit_f_dist_by(x.len(), |i| x[i], |i| df1[i])
}

/// fit_f_dist over n values read through accessors, holding one copy of them (for the median)
/// rather than five: a genome-wide run moderates ~27 million variances.
fn fit_f_dist_by(n: usize, x: impl Fn(usize) -> f64, df1: impl Fn(usize) -> f64) -> (f64, f64) {
    if n == 0 {
        return (f64::NAN, f64::NAN);
    }
    if n == 1 {
        return (x(0), 0.0);
    }
    let ok = |i: usize| {
        let (v, d) = (x(i), df1(i));
        d.is_finite() && d > 1e-15 && v.is_finite() && v > -1e-15
    };
    let mut xv: Vec<f64> = (0..n).filter(|&i| ok(i)).map(|i| x(i).max(0.0)).collect();
    let nok = xv.len();
    if nok == 0 {
        return (f64::NAN, f64::NAN);
    }
    if nok == 1 {
        return (x((0..n).find(|&i| ok(i)).unwrap()), 0.0);
    }
    let h = nok / 2;
    let mut m = *xv.select_nth_unstable_by(h, |a, b| a.partial_cmp(b).unwrap()).1;
    if nok % 2 == 0 {
        m = (m + xv[..h].iter().copied().fold(f64::NEG_INFINITY, f64::max)) / 2.0;
    }
    drop(xv);
    // limma warns that eBayes is unreliable and carries on with m = 1
    if m == 0.0 {
        m = 1.0;
    }
    let floor = 1e-5 * m;
    let logmdigamma = |a: f64| a.ln() - digamma(a);
    // df is the same for nearly every row, so the digamma and trigamma of the last one are reused
    let mut last = (f64::NAN, 0.0, 0.0);
    let mut lg = |d: f64| {
        if d != last.0 {
            last = (d, logmdigamma(d / 2.0), trigamma(d / 2.0));
        }
        (last.1, last.2)
    };
    let (mut esum, mut xsum, mut tsum) = (0.0, 0.0, 0.0);
    for i in (0..n).filter(|&i| ok(i)) {
        let v = x(i).max(0.0).max(floor);
        let (l, t) = lg(df1(i));
        esum += v.ln() + l;
        xsum += v;
        tsum += t;
    }
    let nf = nok as f64;
    let emean = esum / nf;
    let mut evar = 0.0;
    for i in (0..n).filter(|&i| ok(i)) {
        evar += (x(i).max(0.0).max(floor).ln() + lg(df1(i)).0 - emean).powi(2);
    }
    evar = evar / (nf - 1.0) - tsum / nf;
    if evar > 0.0 {
        let df2 = 2.0 * trigamma_inverse(evar);
        ((emean - logmdigamma(df2 / 2.0)).exp(), df2)
    } else {
        (xsum / nf, f64::INFINITY)
    }
}

/* Running per-group methylation level, on the beta scale, accumulated over every value read. This
is the cohort's GLOBAL level -- not a property of any region -- and it tells a reader how much of a
region result is just the whole genome moving. */
#[derive(Default, Clone, Copy)]
struct GlobalBeta {
    case_sum: f64,
    case_n: u64,
    ctrl_sum: f64,
    ctrl_n: u64,
    // reads over every cell of the rows that entered, covered or not: a group's mean depth. Where the
    // groups differ in it, the pseudocount log-ratio differs with no change in methylation.
    case_depth: f64,
    case_cells: u64,
    ctrl_depth: f64,
    ctrl_cells: u64,
}

impl GlobalBeta {
    fn add(&mut self, o: &GlobalBeta) {
        self.case_sum += o.case_sum;
        self.case_n += o.case_n;
        self.ctrl_sum += o.ctrl_sum;
        self.ctrl_n += o.ctrl_n;
        self.case_depth += o.case_depth;
        self.case_cells += o.case_cells;
        self.ctrl_depth += o.ctrl_depth;
        self.ctrl_cells += o.ctrl_cells;
    }
}

/// One row (CpG or element) that entered the model. Compact on purpose: a whole-genome WGBS run
/// holds ~27 million of these, so the position is a u32 and the display means are f32.
#[derive(Clone, Copy)]
struct Cpg {
    pos: u32,
    /// observations per group: every requested sample for a CpG matrix, finite cells for an element one
    n_case: u16,
    n_ctrl: u16,
    /// case minus control mean of d -- upstream's per-CpG `diff`, the limma logFC
    log_fc: f64,
    /// residual variance of the two-group fit; the moderated t once moderate() has run
    s2: f64,
    /// group mean beta over the covered cells, for display: what delta-beta is made of
    beta_ctrl: f32,
    beta_case: f32,
}

impl Cpg {
    fn df(&self) -> f64 {
        self.n_case as f64 + self.n_ctrl as f64 - 2.0
    }
    fn su(&self) -> f64 {
        (1.0 / self.n_case as f64 + 1.0 / self.n_ctrl as f64).sqrt()
    }
    fn delta_beta(&self) -> f64 {
        self.beta_case as f64 - self.beta_ctrl as f64
    }
}

/// A chromosome's rows in the genome-wide arrays, which hold chromosomes in contiguous blocks.
struct Chrom {
    name: String,
    lo: usize,
    hi: usize,
}

struct Genome {
    cpgs: Vec<Cpg>,
    chroms: Vec<Chrom>,
    global: GlobalBeta,
}

/// One matrix file and the chromosomes of the run that it holds.
struct MatrixJob {
    file: String,
    chrs: Vec<String>,
}

/* d = log2((M + 1/2) / (U + 1/2)) for the read counts of one cell, tabulated for the counts that
occur nearly always. Profiling put a quarter of a chromosome's runtime in log2; this is the same
expression, looked up. */
const LR_TABLE: usize = 256;

/// What a matrix file holds. Without read depth either unit is fitted unweighted on the M-value
/// scale, as cpg.annotate() fits array and element data.
#[derive(Clone, Copy, PartialEq)]
enum Values {
    /// a WGBS CpG matrix: betas, with read depth in depth/values
    Counts,
    MValues,
    /// betas with no depth (an array, or an element matrix), taken to M-values clamped to
    /// [0.001, 0.999] for the fit
    Betas,
}
struct LogRatio(Vec<f64>);

impl LogRatio {
    fn new() -> Self {
        let mut v = Vec::with_capacity(LR_TABLE * LR_TABLE);
        for m in 0..LR_TABLE {
            for u in 0..LR_TABLE {
                v.push(((m as f64 + 0.5) / (u as f64 + 0.5)).log2());
            }
        }
        LogRatio(v)
    }
    fn get(&self, m: f64, u: f64) -> f64 {
        if m < LR_TABLE as f64 && u < LR_TABLE as f64 {
            self.0[m as usize * LR_TABLE + u as usize]
        } else {
            ((m + 0.5) / (u + 0.5)).log2()
        }
    }
}

/* What sequencing.annotate() fits, reduced to what it computes.

Upstream builds a 2N-column count matrix -- methylated and unmethylated reads of each sample --
takes voom()$E of it (the voom weights are discarded) and fits lmFit with edgeR::modelMatrixMeth():
a free intercept per sample plus the group effect on the methylated column. With a free intercept
per sample the library sizes cancel and each sample's two columns contribute one number,
d = log2((M + 1/2) / (U + 1/2)). The fit is then the ordinary two-group linear model on d: the same
logFC and t, with a residual variance smaller by a factor of 2, which eBayes is invariant to.

So that is what is fitted here, over EVERY requested sample. A sample with no reads at a CpG is a
0/0 cell and contributes d = 0, as it does upstream (all.cov = FALSE); a CpG with no reads in any
requested sample is dropped, as upstream drops it.

A matrix with no read depth (element, or array) is cpg.annotate()'s case instead: lmFit on the
M-values (stored, or from stored betas), where a missing cell is NA and simply absent, so the group sizes vary by row. `model` false skips the fit and keeps
only the display means, for the background mode. */
fn read_rows(
    file: &File,
    lo: usize,
    hi: usize,
    starts: &[i64],
    case_idx: &[usize],
    ctrl_idx: &[usize],
    values: Values,
    model: bool,
    lr: &LogRatio,
    out: &mut Vec<Cpg>,
) -> Result<GlobalBeta, String> {
    let mut gb = GlobalBeta::default();
    if hi <= lo {
        return Ok(gb);
    }
    let ds = file.dataset("beta/values").map_err(|e| format!("beta/values: {}", e))?;
    let dds = if values != Values::Counts {
        None
    } else {
        Some(file.dataset("depth/values").map_err(|_| {
            "this CpG matrix carries no depth/values, which the model needs; rebuild it with build_cpg_matrix.py"
                .to_string()
        })?)
    };
    let (mut dc, mut dk): (Vec<f64>, Vec<f64>) =
        (Vec::with_capacity(case_idx.len()), Vec::with_capacity(ctrl_idx.len()));
    const CHUNK: usize = 2000;
    let mut cs = lo;
    while cs < hi {
        let ce = (cs + CHUNK).min(hi);
        let beta = ds
            .read_slice_2d::<f32, _>(hdf5::Selection::from((cs..ce, ..)))
            .map_err(|e| format!("HDF5 read: {}", e))?;
        let depth = match &dds {
            Some(d) => Some(
                d.read_slice_2d::<u16, _>(hdf5::Selection::from((cs..ce, ..)))
                    .map_err(|e| format!("HDF5 depth read: {}", e))?,
            ),
            None => None,
        };
        for r in 0..(ce - cs) {
            let brow = beta.row(r);
            dc.clear();
            dk.clear();
            let (mut bc, mut nbc, mut bk, mut nbk) = (0.0f64, 0u32, 0.0f64, 0u32);
            if let Some(dep) = &depth {
                let drow = dep.row(r);
                if case_idx.iter().chain(ctrl_idx).all(|&s| drow[s] == 0) {
                    continue;
                }
                for (idx, d, bsum, bn, is_case) in [
                    (case_idx, &mut dc, &mut bc, &mut nbc, true),
                    (ctrl_idx, &mut dk, &mut bk, &mut nbk, false),
                ] {
                    for &s in idx {
                        let n = drow[s] as f64;
                        let b = brow[s] as f64;
                        if is_case {
                            gb.case_depth += n;
                            gb.case_cells += 1;
                        } else {
                            gb.ctrl_depth += n;
                            gb.ctrl_cells += 1;
                        }
                        let (m, u) = if n > 0.0 && b.is_finite() {
                            *bsum += b;
                            *bn += 1;
                            if is_case {
                                gb.case_sum += b;
                                gb.case_n += 1;
                            } else {
                                gb.ctrl_sum += b;
                                gb.ctrl_n += 1;
                            }
                            let m = (b * n).round();
                            (m, n - m)
                        } else {
                            (0.0, 0.0)
                        };
                        if model {
                            d.push(lr.get(m, u));
                        }
                    }
                }
                if !model {
                    dc.resize(case_idx.len(), 0.0);
                    dk.resize(ctrl_idx.len(), 0.0);
                }
            } else {
                for (idx, d, bsum, bn, is_case) in [
                    (case_idx, &mut dc, &mut bc, &mut nbc, true),
                    (ctrl_idx, &mut dk, &mut bk, &mut nbk, false),
                ] {
                    for &s in idx {
                        let v = brow[s] as f64;
                        if !v.is_finite() {
                            continue;
                        }
                        let (v, b) = if values == Values::Betas {
                            let c = v.clamp(0.001, 0.999);
                            ((c / (1.0 - c)).log2(), v)
                        } else {
                            let e = v.exp2();
                            (v, e / (1.0 + e))
                        };
                        *bsum += b;
                        *bn += 1;
                        if is_case {
                            gb.case_sum += b;
                            gb.case_n += 1;
                        } else {
                            gb.ctrl_sum += b;
                            gb.ctrl_n += 1;
                        }
                        d.push(v);
                    }
                }
                // lmFit leaves a row without both groups, or without a residual df, unestimated
                if dc.is_empty() || dk.is_empty() || dc.len() + dk.len() < 3 {
                    continue;
                }
            }
            let (log_fc, s2) = if model {
                two_group(&dc, &dk)
            } else {
                (f64::NAN, f64::NAN)
            };
            let mean = |s: f64, n: u32| if n > 0 { (s / n as f64) as f32 } else { f32::NAN };
            out.push(Cpg {
                pos: starts[cs + r] as u32,
                n_case: dc.len() as u16,
                n_ctrl: dk.len() as u16,
                log_fc,
                s2,
                beta_ctrl: mean(bk, nbk),
                beta_case: mean(bc, nbc),
            });
        }
        cs = ce;
    }
    Ok(gb)
}

/// The two-group linear model: (case mean - control mean, pooled residual variance).
fn two_group(case: &[f64], ctrl: &[f64]) -> (f64, f64) {
    let mc = case.iter().sum::<f64>() / case.len() as f64;
    let mk = ctrl.iter().sum::<f64>() / ctrl.len() as f64;
    let ss = case.iter().map(|&x| (x - mc).powi(2)).sum::<f64>() + ctrl.iter().map(|&x| (x - mk).powi(2)).sum::<f64>();
    (mc - mk, ss / (case.len() + ctrl.len() - 2) as f64)
}

/// Column index of each named sample in this file; a name the file lacks is skipped.
fn sample_columns(samples: &[String], names: &[&str]) -> Vec<usize> {
    let smap: HashMap<&str, usize> = samples.iter().enumerate().map(|(i, s)| (s.as_str(), i)).collect();
    names.iter().filter_map(|s| smap.get(s).copied()).collect()
}

/// Every chromosome of the job that this file holds, in the file's order, read into the genome.
fn read_matrix(
    job: &MatrixJob,
    cases: &[&str],
    ctrls: &[&str],
    values: Values,
    model: bool,
    lr: &LogRatio,
    g: &mut Genome,
) -> Result<(), String> {
    let file = File::open(&job.file).map_err(|e| format!("HDF5 open {}: {}", job.file, e))?;
    let meta = read_h5_metadata(&file)?;
    let ci = sample_columns(&meta.samples, cases);
    let ki = sample_columns(&meta.samples, ctrls);
    if ci.is_empty() || ki.is_empty() {
        return Err(format!("{}: no case or no control sample in this matrix", job.file));
    }
    let mut pfx = 0usize;
    for (name, &n) in meta.chr_names.iter().zip(&meta.chr_rows) {
        if job.chrs.iter().any(|c| c == name) {
            let lo = g.cpgs.len();
            let gb = read_rows(
                &file,
                pfx,
                pfx + n,
                &meta.starts,
                &ci,
                &ki,
                values,
                model,
                lr,
                &mut g.cpgs,
            )?;
            g.global.add(&gb);
            g.chroms.push(Chrom {
                name: name.clone(),
                lo,
                hi: g.cpgs.len(),
            });
        }
        pfx += n;
    }
    Ok(())
}

/// Every job's chromosomes, in the jobs' order, into one array sized up front from the matrices'
/// row counts, so it is never reallocated -- a reallocation would hold the genome twice.
fn read_genome(
    jobs: &[MatrixJob],
    cases: &[&str],
    ctrls: &[&str],
    values: Values,
    model: bool,
) -> Result<Genome, String> {
    let mut rows = 0usize;
    for job in jobs {
        let file = File::open(&job.file).map_err(|e| format!("HDF5 open {}: {}", job.file, e))?;
        let (names, lens) = read_chroms(&file)?;
        rows += names
            .iter()
            .zip(&lens)
            .filter(|(c, _)| job.chrs.contains(c))
            .map(|(_, &n)| n)
            .sum::<usize>();
    }
    let mut g = Genome {
        cpgs: Vec::with_capacity(rows),
        chroms: Vec::new(),
        global: GlobalBeta::default(),
    };
    let lr = LogRatio::new();
    for job in jobs {
        read_matrix(job, cases, ctrls, values, model, &lr, &mut g)?;
    }
    Ok(g)
}

/// limma's eBayes prior over every row of the run, and the pooled df that caps the moderated df.
struct Prior {
    s20: f64,
    df0: f64,
    df_cap: f64,
}

fn ebayes(cpgs: &[Cpg]) -> Prior {
    let df_cap = cpgs.iter().map(|c| c.df()).sum::<f64>();
    // squeezeVar leaves fewer than 3 variances unmoderated
    if cpgs.len() < 3 {
        return Prior {
            s20: f64::NAN,
            df0: 0.0,
            df_cap,
        };
    }
    let (s20, df0) = fit_f_dist_by(cpgs.len(), |i| cpgs[i].s2, |i| cpgs[i].df());
    Prior { s20, df0, df_cap }
}

/// eBayes then topTable for one row: (moderated t, two-sided p).
fn moderate(c: &Cpg, pr: &Prior) -> (f64, f64) {
    let df = c.df();
    let s2post = if pr.df0 == 0.0 {
        c.s2
    } else if pr.df0.is_infinite() {
        pr.s20
    } else {
        (df * c.s2 + pr.df0 * pr.s20) / (df + pr.df0)
    };
    let t = c.log_fc / c.su() / s2post.sqrt();
    (t, 2.0 * pt_upper(t.abs(), (df + pr.df0).min(pr.df_cap)))
}

/// The kernel-smoothed p-value of every row of one chromosome, as DMRcate's KernelTest gives it.
fn smooth(cpgs: &[Cpg], t: &[f64], lambda: f64, c: f64) -> Vec<f64> {
    let pos: Vec<i64> = cpgs.iter().map(|x| x.pos as i64).collect();
    kernel_smooth_log(&pos, t, lambda, c)
        .into_iter()
        .map(f64::exp)
        .collect()
}

/// What a region view needs to recompute any region of a run exactly as the run saw it. BH and the
/// adaptive cutoff are both monotone in the p-value, so "significant" is "p at or below a value",
/// and that value is all that has to be carried; the kernel only reaches 5 sigma.
struct Constants {
    prior: Prior,
    /// the largest raw p among individually significant rows (per-CpG BH < fdr); None when there are none
    ind_p_cut: Option<f64>,
    /// the largest smoothed raw p among the rows the adaptive cutoff kept, and that cutoff on the
    /// smoothed FDR itself; None when nothing was kept
    smoothed_raw_cut: Option<f64>,
    smoothed_fdr_cut: Option<f64>,
    nsig: usize,
}

impl Constants {
    fn to_json(&self) -> Value {
        let f = |v: f64| if v.is_finite() { json!(v) } else { Value::Null };
        json!({
            "s20": f(self.prior.s20),
            // null is infinite: no prior df was estimable, every variance is the prior
            "df0": f(self.prior.df0),
            "df_cap": self.prior.df_cap,
            "ind_p_cut": self.ind_p_cut,
            "smoothed_raw_cut": self.smoothed_raw_cut,
            "smoothed_fdr_cut": self.smoothed_fdr_cut,
            "nsig": self.nsig
        })
    }
    fn from_json(v: &Value) -> Option<Self> {
        Some(Constants {
            prior: Prior {
                s20: v["s20"].as_f64().unwrap_or(f64::NAN),
                df0: v["df0"].as_f64().unwrap_or(f64::INFINITY),
                df_cap: v["df_cap"].as_f64()?,
            },
            ind_p_cut: v["ind_p_cut"].as_f64(),
            smoothed_raw_cut: v["smoothed_raw_cut"].as_f64(),
            smoothed_fdr_cut: v["smoothed_fdr_cut"].as_f64(),
            nsig: v["nsig"].as_u64().unwrap_or(0) as usize,
        })
    }
}

/// One called region, before the region-wise corrections and the CpG floor: its first and last
/// row, inclusive, in the genome-wide arrays.
struct Segment {
    chrom: usize,
    lo: usize,
    hi: usize,
}

/* dmrcate() after the annotation: kernel test per chromosome, BH of the smoothed p over the whole
run, the adaptive cutoff, segmentation, region-wise statistics and their corrections, the CpG floor.
Returns the DMRs, per-row individual significance, and the constants. */
fn call_dmrs(
    g: &mut Genome,
    fdr_cut: f64,
    lambda: f64,
    c_param: f64,
    min_cpgs: usize,
) -> (Vec<Dmr>, Vec<bool>, Constants) {
    let prior = ebayes(&g.cpgs);
    let mut p = vec![0.0f64; g.cpgs.len()];
    for (i, c) in g.cpgs.iter_mut().enumerate() {
        let (t, pv) = moderate(c, &prior);
        c.s2 = t;
        p[i] = pv;
    }
    let ind_sig: Vec<bool> = bh_adjust(&p).into_iter().map(|a| a < fdr_cut).collect();
    let ind_p_cut = p
        .iter()
        .zip(&ind_sig)
        .filter(|(_, &s)| s)
        .map(|(&v, _)| v)
        .reduce(f64::max);

    /* The kernel test, per chromosome. A chromosome with exactly one row is dropped before it, as
    dmrcate() drops it: its rows keep a NaN, which BH leaves out of n, so they take no part in the
    correction, the count of significant rows or the segmentation. */
    let mut raw = vec![f64::NAN; g.cpgs.len()];
    let mut chrom_of = vec![0u16; g.cpgs.len()];
    let mut nsig = 0usize;
    for (k, ch) in g.chroms.iter().enumerate() {
        chrom_of[ch.lo..ch.hi].iter_mut().for_each(|x| *x = k as u16);
        if ch.hi - ch.lo < 2 {
            continue;
        }
        let t: Vec<f64> = g.cpgs[ch.lo..ch.hi].iter().map(|c| c.s2).collect();
        raw[ch.lo..ch.hi].copy_from_slice(&smooth(&g.cpgs[ch.lo..ch.hi], &t, lambda, c_param));
        nsig += ind_sig[ch.lo..ch.hi].iter().filter(|&&s| s).count();
    }
    let (fdr, order) = bh_adjust_ordered(&raw);
    let mut cons = Constants {
        prior,
        ind_p_cut,
        smoothed_raw_cut: None,
        smoothed_fdr_cut: None,
        nsig,
    };
    // dmrcate() stops here: "returned no significant CpGs, hence there are no DMRs"
    if nsig == 0 {
        return (vec![], ind_sig, cons);
    }
    // sort(fdr)[nsig]: `order` runs from the largest smoothed p down, and BH is monotone in it
    let pcut = fdr[order[order.len() - nsig.min(order.len())] as usize];
    drop(order);
    let sig: Vec<bool> = fdr.iter().map(|&f| f <= pcut).collect();
    cons.smoothed_fdr_cut = Some(pcut);
    cons.smoothed_raw_cut = raw
        .iter()
        .zip(&sig)
        .filter(|(_, &s)| s)
        .map(|(&v, _)| v)
        .reduce(f64::max);
    drop(raw);
    let segs = segment(&chrom_of, &sig, &g.cpgs, lambda);
    let dmrs = region_stats(&segs, g, &p, &fdr, min_cpgs);
    (dmrs, ind_sig, cons)
}

/* dmrcate()'s segmentation: the significant rows, split wherever the next one is on another
chromosome or more than lambda bp away. A region spans from its first significant row to its last,
and EVERY row in between belongs to it, significant or not -- its CpG count and every statistic
below are over that whole span, as upstream's region factor assigns them. */
fn segment(chrom_of: &[u16], sig: &[bool], cpgs: &[Cpg], lambda: f64) -> Vec<Segment> {
    let k: Vec<usize> = (0..sig.len()).filter(|&i| sig[i]).collect();
    let mut out = Vec::new();
    // upstream asserts at least two significant rows
    if k.len() < 2 {
        return out;
    }
    let mut start = k[0];
    for w in 0..k.len() {
        let last = w + 1 == k.len();
        let jump = last
            || chrom_of[k[w + 1]] != chrom_of[k[w]]
            || (cpgs[k[w + 1]].pos as f64 - cpgs[k[w]].pos as f64) > lambda;
        if jump {
            out.push(Segment {
                chrom: chrom_of[start] as usize,
                lo: start,
                hi: k[w],
            });
            if !last {
                start = k[w + 1];
            }
        }
    }
    out
}

/// The value of largest magnitude, the first one on a tie, as which.max(abs(x)) picks it.
fn max_abs(v: impl Iterator<Item = f64>) -> f64 {
    let mut best = f64::NAN;
    for x in v {
        if best.is_nan() || x.abs() > best.abs() {
            best = x;
        }
    }
    best
}

/// One DMR as dmrcate() reports it, plus the display delta-beta. Typed rather than a JSON map
/// because a genome-wide run holds a few hundred thousand of them.
#[derive(Serialize)]
struct Dmr {
    chr: String,
    start: u32,
    stop: u32,
    no_cpgs: usize,
    min_smoothed_fdr: f64,
    #[serde(rename = "Stouffer")]
    stouffer: Option<f64>,
    #[serde(rename = "HMFDR")]
    hmfdr: Option<f64>,
    #[serde(rename = "Fisher")]
    fisher: Option<f64>,
    maxdiff: f64,
    meandiff: f64,
    delta_beta_max: Option<f64>,
    delta_beta_mean: Option<f64>,
    direction: &'static str,
}

/* dmrcate()'s region-wise statistics over each span: CpG count, the minimum smoothed FDR, the
Stouffer, harmonic-mean and Fisher combinations of the raw per-CpG p-values -- each BH-corrected
across every region built, the ones under the CpG floor included -- and the largest and mean
per-CpG diff. Then the floor. Delta-beta is not upstream's: it is the display effect, carried
beside upstream's logit2 diff. */
fn region_stats(segs: &[Segment], g: &Genome, p: &[f64], fdr: &[f64], min_cpgs: usize) -> Vec<Dmr> {
    let nrm = std_normal();
    let len = |s: &Segment| (s.hi - s.lo + 1) as f64;
    let stouffer: Vec<f64> = segs
        .iter()
        .map(|s| nrm.cdf(p[s.lo..=s.hi].iter().map(|&x| qnorm(x)).sum::<f64>() / len(s).sqrt()))
        .collect();
    let hm: Vec<f64> = segs
        .iter()
        .map(|s| 1.0 / (p[s.lo..=s.hi].iter().map(|&x| 1.0 / x).sum::<f64>() / len(s)))
        .collect();
    let fisher: Vec<f64> = segs
        .iter()
        .map(|s| chisq_sf(p[s.lo..=s.hi].iter().map(|&x| x.ln()).sum::<f64>() * -2.0, 2.0 * len(s)))
        .collect();
    let (stouffer, hmfdr, fisher) = (bh_adjust(&stouffer), bh_adjust(&hm), bh_adjust(&fisher));
    let fin = |v: f64| if v.is_finite() { Some(v) } else { None };
    segs.iter()
        .enumerate()
        .filter(|(_, s)| s.hi - s.lo + 1 >= min_cpgs)
        .map(|(a, s)| {
            let span = &g.cpgs[s.lo..=s.hi];
            let meandiff = span.iter().map(|c| c.log_fc).sum::<f64>() / len(s);
            let (mut dn, mut dsum, mut dmax) = (0usize, 0.0, f64::NAN);
            for d in span.iter().map(|c| c.delta_beta()).filter(|d| d.is_finite()) {
                dn += 1;
                dsum += d;
                if dmax.is_nan() || d.abs() > dmax.abs() {
                    dmax = d;
                }
            }
            Dmr {
                chr: g.chroms[s.chrom].name.clone(),
                start: span[0].pos,
                stop: span[span.len() - 1].pos,
                no_cpgs: span.len(),
                min_smoothed_fdr: fdr[s.lo..=s.hi].iter().copied().fold(f64::INFINITY, f64::min),
                stouffer: fin(stouffer[a]),
                hmfdr: fin(hmfdr[a]),
                fisher: fin(fisher[a]),
                maxdiff: max_abs(span.iter().map(|c| c.log_fc)),
                meandiff,
                delta_beta_max: fin(dmax),
                delta_beta_mean: if dn > 0 { Some(dsum / dn as f64) } else { None },
                // Ours, not a DMRcate column: the sign of the display delta-beta, which every figure
                // plots. meandiff is a log-ratio with a +0.5 pseudocount, which pulls shallow samples
                // toward 0, so where the groups differ in read depth its sign can follow depth rather
                // than methylation (DISCOVER CSF: 11% of DMRs disagreed). No covered cell: meandiff's.
                direction: if (if dn > 0 { dsum } else { meandiff }) >= 0.0 {
                    "hyper"
                } else {
                    "hypo"
                },
            }
        })
        .collect()
}

/// Half-open range of the rows of `ch` whose position is within [start, stop].
fn rows_in(cpgs: &[Cpg], ch: &Chrom, start: i64, stop: i64) -> (usize, usize) {
    let blk = &cpgs[ch.lo..ch.hi];
    (
        ch.lo + blk.partition_point(|c| (c.pos as i64) < start),
        ch.lo + blk.partition_point(|c| (c.pos as i64) <= stop),
    )
}

/// Mean beta per group in fixed-width bins along each chromosome, the profile methylome papers
/// plot for a genome-wide comparison (Zhou 2018, Nat Genet, bins the genome at 100 kb and plots
/// mean solo-WCGW methylation per bin to show PMD/HMD structure; Berman 2011 does the same at
/// megabase scale). It is NOT a DMR summary: every bin is reported whether or not anything was
/// called in it, so a flat stretch reads as "measured and unchanged" rather than as absence.
/// Returns (chr, bin start, n rows, ctrl mean, case mean) per non-empty bin.
fn bin_methylation(g: &Genome, bin_bp: i64) -> Vec<(String, i64, u64, f64, f64)> {
    let mut out = Vec::new();
    for ch in &g.chroms {
        let mut cur: Option<i64> = None;
        let (mut n, mut cs, mut ks) = (0u64, 0.0f64, 0.0f64);
        let mut flush = |b: Option<i64>, n: u64, cs: f64, ks: f64| {
            if let Some(b) = b {
                if n > 0 {
                    out.push((ch.name.clone(), b * bin_bp, n, cs / n as f64, ks / n as f64));
                }
            }
        };
        for c in &g.cpgs[ch.lo..ch.hi] {
            // a row with no covered cell in either arm contributes to no bin
            if !c.beta_ctrl.is_finite() || !c.beta_case.is_finite() {
                continue;
            }
            let b = c.pos as i64 / bin_bp;
            if cur != Some(b) {
                flush(cur, n, cs, ks);
                cur = Some(b);
                n = 0;
                cs = 0.0;
                ks = 0.0;
            }
            n += 1;
            cs += c.beta_ctrl as f64;
            ks += c.beta_case as f64;
        }
        flush(cur, n, cs, ks);
    }
    out
}

/* Mean beta-scale difference over the rows inside a window, and how many there were. The
matched-background correction asks "did this region move more than a region like it would have
drifted anyway?", which needs delta-beta for thousands of windows that are NOT DMRs. */
fn window_delta(g: &Genome, chroms: &HashMap<&str, usize>, qchr: &str, qstart: i64, qstop: i64) -> (usize, f64) {
    let Some(&k) = chroms.get(qchr) else {
        return (0, f64::NAN);
    };
    let (lo, hi) = rows_in(&g.cpgs, &g.chroms[k], qstart, qstop);
    let (mut n, mut sum) = (0usize, 0.0f64);
    for c in &g.cpgs[lo..hi] {
        let d = c.delta_beta();
        if d.is_finite() {
            sum += d;
            n += 1;
        }
    }
    (n, if n > 0 { sum / n as f64 } else { f64::NAN })
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
    sig: &[bool],
    loess_g1: &Option<(Vec<f64>, Vec<f64>, Vec<f64>)>,
    loess_g2: &Option<(Vec<f64>, Vec<f64>, Vec<f64>)>,
    eval_pos: &[f64],
    xmin: f64,
    xmax: f64,
    width: u32,
    height: u32,
    dpr: f32,
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
        let is_sig = sig[i];
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

macro_rules! bail { ($($t:tt)*) => { { println!("{}", json!({"error": format!($($t)*)})); return; } } }

fn parse_ranges(v: &Value) -> Vec<(String, i64, i64)> {
    v.as_array()
        .map(|a| {
            a.iter()
                .filter_map(|r| {
                    let (c, s, e) = (r["chr"].as_str()?, r["start"].as_i64()?, r["stop"].as_i64()?);
                    if c.is_empty() || e < s {
                        None
                    } else {
                        Some((c.to_string(), s, e))
                    }
                })
                .collect()
        })
        .unwrap_or_default()
}

fn names(v: &Value) -> Vec<&str> {
    v.as_str().unwrap_or("").split(',').filter(|s| !s.is_empty()).collect()
}

fn r5(v: f64) -> Value {
    if v.is_finite() {
        json!((v * 100000.0).round() / 100000.0)
    } else {
        Value::Null
    }
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
    let jobs: Vec<MatrixJob> = p["matrices"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|m| {
                    Some(MatrixJob {
                        file: m["file"].as_str()?.to_string(),
                        chrs: m["chrs"]
                            .as_array()?
                            .iter()
                            .filter_map(|c| c.as_str().map(String::from))
                            .collect(),
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    let (cases, ctrls) = (names(&p["case"]), names(&p["control"]));
    if jobs.is_empty() || cases.is_empty() || ctrls.is_empty() {
        bail!("Missing required parameters: matrices, case and control");
    }
    // Set by the server from the ds config entry, never by the client: an element matrix stores
    // M-values, betas alone, or betas with read depth.
    let values = if p["mvalues"].as_bool().unwrap_or(false) {
        Values::MValues
    } else if p["betas"].as_bool().unwrap_or(false) {
        Values::Betas
    } else {
        Values::Counts
    };
    let fdr_cut = p["fdr_cutoff"].as_f64().unwrap_or(0.05);
    let lambda = p["lambda"].as_f64().unwrap_or(1000.0);
    let c_param = p["C"].as_f64().unwrap_or(2.0);
    // dmrcate()'s min.cpgs
    let min_cpgs = p["min_cpgs"].as_u64().unwrap_or(2) as usize;
    let diagnostic = |n: usize| {
        json!({
            "total_probes_analyzed": n,
            "peak_memory_mb": (get_rss_mb() * 10.0).round() / 10.0,
            "start_memory_mb": (rss_start * 10.0).round() / 10.0,
            "cpu_seconds": (get_cpu_seconds() * 100.0).round() / 100.0,
            "threads": THREADS,
            "elapsed_ms": t0.elapsed().as_millis()
        })
    };

    if p["region"].is_object() {
        region_mode(&p, &jobs, &cases, &ctrls, values, lambda, c_param, &diagnostic);
        return;
    }

    let background = parse_ranges(&p["background_regions"]);
    let windows = parse_ranges(&p["windows"]);
    if windows.is_empty() {
        // the background correction only needs each window's delta-beta, not the model
        let g = match read_genome(&jobs, &cases, &ctrls, values, false) {
            Ok(g) => g,
            Err(e) => bail!("{}", e),
        };
        let chroms: HashMap<&str, usize> = g.chroms.iter().enumerate().map(|(i, c)| (c.name.as_str(), i)).collect();
        let bg: Vec<Value> = background
            .iter()
            .map(|(c, s, e)| {
                let (n, d) = window_delta(&g, &chroms, c, *s, *e);
                json!({"chr": c, "start": s, "stop": e, "n_probes": n, "delta": r5(d)})
            })
            .collect();
        println!("{}", json!({"background": bg, "diagnostic": diagnostic(g.cpgs.len())}));
        return;
    }

    let mut g = match read_genome(&jobs, &cases, &ctrls, values, true) {
        Ok(g) => g,
        Err(e) => bail!("{}", e),
    };
    if g.cpgs.len() < 3 {
        bail!("Too few probes after filtering ({})", g.cpgs.len());
    }
    let (dmrs, ind_sig, cons) = call_dmrs(&mut g, fdr_cut, lambda, c_param, min_cpgs);

    let chroms: HashMap<&str, usize> = g.chroms.iter().enumerate().map(|(i, c)| (c.name.as_str(), i)).collect();
    // DMRs by chromosome, in position order, so a window's are one contiguous run
    let mut by_chr: HashMap<&str, Vec<&Dmr>> = HashMap::new();
    for d in &dmrs {
        by_chr.entry(d.chr.as_str()).or_default().push(d);
    }
    let out: Vec<Window> = windows
        .iter()
        .map(|(c, s, e)| {
            let (n, nsig) = match chroms.get(c.as_str()) {
                Some(&k) => {
                    let (lo, hi) = rows_in(&g.cpgs, &g.chroms[k], *s, *e);
                    (hi - lo, ind_sig[lo..hi].iter().filter(|&&x| x).count())
                }
                None => (0, 0),
            };
            let ds = by_chr.get(c.as_str()).map_or(vec![], |v| {
                let a = v.partition_point(|d| (d.stop as i64) < *s);
                let b = v.partition_point(|d| (d.start as i64) <= *e);
                v[a..b.max(a)].to_vec()
            });
            Window {
                chr: c,
                start: *s,
                stop: *e,
                n_probes: n,
                n_sig_probes: nsig,
                dmrs: ds,
            }
        })
        .collect();
    let bin_bp = p["bin_bp"].as_i64().unwrap_or(0);
    let bins: Vec<Value> = if bin_bp > 0 {
        bin_methylation(&g, bin_bp)
            .into_iter()
            .map(|(c, start, n, ctrl, case)| json!({"chr": c, "start": start, "n_probes": n, "control": r5(ctrl), "case": r5(case)}))
            .collect()
    } else {
        vec![]
    };
    let gl = g.global;
    let mean = |s: f64, n: u64| if n > 0 { s / n as f64 } else { f64::NAN };
    let (gc, gk) = (mean(gl.ctrl_sum, gl.ctrl_n), mean(gl.case_sum, gl.case_n));
    let mut diag = diagnostic(g.cpgs.len());
    diag["global_methylation"] = json!({
        "control_mean_beta": r5(gc),
        "case_mean_beta": r5(gk),
        "shift": r5(gk - gc),
        "values_counted": gl.case_n + gl.ctrl_n,
        "control_n": gl.ctrl_n,
        "case_n": gl.case_n,
        // absent for an element matrix, which carries no depth
        "control_mean_depth": if gl.ctrl_cells > 0 { Some(r5(gl.ctrl_depth / gl.ctrl_cells as f64)) } else { None },
        "case_mean_depth": if gl.case_cells > 0 { Some(r5(gl.case_depth / gl.case_cells as f64)) } else { None }
    });
    let res = ScanOut {
        regions: out,
        constants: cons.to_json(),
        bin_methylation: bins,
        bin_bp,
        diagnostic: diag,
    };
    let stdout = io::stdout();
    let mut w = io::BufWriter::new(stdout.lock());
    if serde_json::to_writer(&mut w, &res).is_ok() {
        let _ = io::Write::write_all(&mut w, b"\n");
    }
}

/// One requested window of a scan and the run's DMRs that overlap it, borrowed, not copied.
#[derive(Serialize)]
struct Window<'a> {
    chr: &'a str,
    start: i64,
    stop: i64,
    n_probes: usize,
    n_sig_probes: usize,
    dmrs: Vec<&'a Dmr>,
}

#[derive(Serialize)]
struct ScanOut<'a> {
    regions: Vec<Window<'a>>,
    constants: Value,
    bin_methylation: Vec<Value>,
    bin_bp: i64,
    diagnostic: Value,
}

/* One region of a run already made: its rows recomputed from the run's constants, the run's DMRs
that overlap it, and the per-CpG means, LOESS and track a region view draws. The kernel only
reaches 5 sigma, so reading that margin either side makes every smoothed value in the region the
one the run computed; the prior and the two cuts make every significance call the run's. */
fn region_mode(
    p: &Value,
    jobs: &[MatrixJob],
    cases: &[&str],
    ctrls: &[&str],
    values: Values,
    lambda: f64,
    c_param: f64,
    diagnostic: &dyn Fn(usize) -> Value,
) {
    let Some(cons) = Constants::from_json(&p["constants"]) else {
        bail!("region mode needs the run's constants");
    };
    let (qchr, qstart, qstop) = (
        p["region"]["chr"].as_str().unwrap_or(""),
        p["region"]["start"].as_i64().unwrap_or(0),
        p["region"]["stop"].as_i64().unwrap_or(0),
    );
    let Some(job) = jobs.iter().find(|j| j.chrs.iter().any(|c| c == qchr)) else {
        bail!("no matrix holds {}", qchr);
    };
    let file = match File::open(&job.file) {
        Ok(f) => f,
        Err(e) => bail!("HDF5 open: {}", e),
    };
    let meta = match read_h5_metadata(&file) {
        Ok(m) => m,
        Err(e) => bail!("{}", e),
    };
    let (ci, ki) = (
        sample_columns(&meta.samples, cases),
        sample_columns(&meta.samples, ctrls),
    );
    let Some(k) = meta.chr_names.iter().position(|c| c == qchr) else {
        bail!("{} is not in the matrix", qchr);
    };
    let lo_chr: usize = meta.chr_rows[..k].iter().sum();
    let hi_chr = lo_chr + meta.chr_rows[k];
    let margin = (5.0 * lambda / c_param).floor() as i64 + 1;
    let blk = &meta.starts[lo_chr..hi_chr];
    let lo = lo_chr + blk.partition_point(|&s| s < qstart - margin);
    let hi = lo_chr + blk.partition_point(|&s| s <= qstop + margin);
    let mut cpgs = Vec::new();
    if let Err(e) = read_rows(
        &file,
        lo,
        hi,
        &meta.starts,
        &ci,
        &ki,
        values,
        true,
        &LogRatio::new(),
        &mut cpgs,
    ) {
        bail!("{}", e);
    }
    let t: Vec<f64> = cpgs.iter().map(|c| moderate(c, &cons.prior).0).collect();
    let ind_p: Vec<f64> = cpgs.iter().map(|c| moderate(c, &cons.prior).1).collect();
    let raw = if cpgs.len() >= 2 {
        smooth(&cpgs, &t, lambda, c_param)
    } else {
        vec![1.0; cpgs.len()]
    };
    let a = cpgs.partition_point(|c| (c.pos as i64) < qstart);
    let b = cpgs.partition_point(|c| (c.pos as i64) <= qstop);
    let inr = &cpgs[a..b];
    let rpos: Vec<i64> = inr.iter().map(|c| c.pos as i64).collect();
    let mg1: Vec<f64> = inr.iter().map(|c| c.beta_ctrl as f64).collect();
    let mg2: Vec<f64> = inr.iter().map(|c| c.beta_case as f64).collect();
    let sig: Vec<bool> = ind_p[a..b]
        .iter()
        .map(|&v| cons.ind_p_cut.map_or(false, |cut| v <= cut))
        .collect();
    let smoothed_sig: Vec<bool> = raw[a..b]
        .iter()
        .map(|&v| cons.smoothed_raw_cut.map_or(false, |cut| v <= cut))
        .collect();
    let dmrs: Vec<Value> = p["dmrs"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter(|d| {
                    d["chr"].as_str() == Some(qchr)
                        && d["stop"].as_i64().unwrap_or(0) >= qstart
                        && d["start"].as_i64().unwrap_or(0) <= qstop
                })
                .cloned()
                .collect()
        })
        .unwrap_or_default();

    let n_eval = 200usize;
    let eval_pos: Vec<f64> = (0..n_eval)
        .map(|i| qstart as f64 + (qstop as f64 - qstart as f64) * i as f64 / (n_eval - 1) as f64)
        .collect();
    let loess_g1 = loess_fit(&rpos, &mg1, &eval_pos, 0.75);
    let loess_g2 = loess_fit(&rpos, &mg2, &eval_pos, 0.75);
    let lj = |l: &Option<(Vec<f64>, Vec<f64>, Vec<f64>)>, i: usize| -> Vec<f64> {
        l.as_ref().map_or(vec![], |l| [&l.0, &l.1, &l.2][i].clone())
    };
    let loess_json = json!({
        "positions": eval_pos.iter().map(|&x| x.round() as i64).collect::<Vec<_>>(),
        "group1_fitted": lj(&loess_g1, 0),
        "group1_ci_lower": lj(&loess_g1, 1),
        "group1_ci_upper": lj(&loess_g1, 2),
        "group2_fitted": lj(&loess_g2, 0),
        "group2_ci_lower": lj(&loess_g2, 1),
        "group2_ci_upper": lj(&loess_g2, 2),
    });
    let mut colors: HashMap<String, String> = HashMap::new();
    if let Some(obj) = p["colors"].as_object() {
        for (k, v) in obj {
            if let Some(s) = v.as_str() {
                colors.insert(k.clone(), s.to_string());
            }
        }
    }
    let track_png = render_track_png(
        &rpos,
        &mg1,
        &mg2,
        &sig,
        &loess_g1,
        &loess_g2,
        &eval_pos,
        qstart as f64,
        qstop as f64,
        p["blockWidth"].as_u64().unwrap_or(800) as u32,
        150,
        p["devicePixelRatio"].as_f64().unwrap_or(1.0) as f32,
        p["maxLoessRegion"].as_f64().unwrap_or(50000.0),
        &colors,
    );
    let r4 = |v: f64| {
        if v.is_finite() {
            json!((v * 10000.0).round() / 10000.0)
        } else {
            Value::Null
        }
    };
    let spacings: Vec<i64> = rpos.windows(2).map(|w| w[1] - w[0]).collect();
    let mut diag = diagnostic(inr.len());
    diag["probes"] = json!({
        "positions": rpos,
        "mean_group1": mg1.iter().map(|&v| r4(v)).collect::<Vec<_>>(),
        "mean_group2": mg2.iter().map(|&v| r4(v)).collect::<Vec<_>>(),
        // individually significant in the run (per-CpG BH < fdr), and kept by its smoothed cutoff
        "sig": sig,
        "smoothed_sig": smoothed_sig,
        "logFC": inr.iter().map(|c| r4(c.log_fc)).collect::<Vec<_>>()
    });
    diag["loess"] = loess_json;
    diag["probe_spacings"] = json!(spacings);
    diag["track_png"] = json!(track_png);
    println!("{}", json!({"dmrs": dmrs, "diagnostic": diag}));
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cpg(pos: u32, log_fc: f64, s2: f64) -> Cpg {
        Cpg {
            pos,
            n_case: 3,
            n_ctrl: 3,
            log_fc,
            s2,
            beta_ctrl: 0.2,
            beta_case: 0.6,
        }
    }

    #[test]
    fn a_beta_matrix_is_fitted_on_clamped_m_values_with_no_depth() {
        // 2 elements x 4 samples (2 case, 2 control); no depth/values, which a CpG matrix would need
        let path = std::env::temp_dir().join(format!("dmrcate-betas-{}.h5", std::process::id()));
        let file = File::create(&path).unwrap();
        let beta = ndarray::arr2(&[[0.8f32, 0.6, 0.2, 0.4], [1.0, f32::NAN, 0.0, 0.5]]);
        file.create_group("beta")
            .unwrap()
            .new_dataset_builder()
            .with_data(&beta)
            .create("values")
            .unwrap();
        let mut out = Vec::new();
        read_rows(
            &file,
            0,
            2,
            &[100, 200],
            &[0, 1],
            &[2, 3],
            Values::Betas,
            true,
            &LogRatio::new(),
            &mut out,
        )
        .unwrap();
        std::fs::remove_file(&path).ok();
        assert_eq!(out.len(), 2);
        let m = |b: f64| {
            let c = b.clamp(0.001, 0.999);
            (c / (1.0 - c)).log2()
        };
        let fc0 = (m(0.8f32 as f64) + m(0.6f32 as f64)) / 2.0 - (m(0.2f32 as f64) + m(0.4f32 as f64)) / 2.0;
        assert!((out[0].log_fc - fc0).abs() < 1e-12, "the fit is on M-values");
        assert!(
            (out[0].beta_case - 0.7).abs() < 1e-6 && (out[0].beta_ctrl - 0.3).abs() < 1e-6,
            "display means are betas"
        );
        // the NaN cell is absent, and 0 and 1 clamp rather than going infinite
        assert_eq!((out[1].n_case, out[1].n_ctrl), (1, 2));
        assert!(out[1].log_fc.is_finite());
    }

    /* The values each port of an R function is checked against were computed in R 4.5.2 with
    limma 3.66 (see the comment on each). */
    #[test]
    fn bh_matches_p_adjust_and_drops_nan_before_counting() {
        // p.adjust(c(0.01, NA, 0.04, 0.03), "BH")
        let a = bh_adjust(&[0.01, f64::NAN, 0.04, 0.03]);
        assert!(
            (a[0] - 0.03).abs() < 1e-15 && a[1].is_nan() && (a[2] - 0.04).abs() < 1e-15 && (a[3] - 0.04).abs() < 1e-15
        );
    }

    #[test]
    fn qnorm_matches_r_into_the_far_tail() {
        for (p, q) in [
            (1e-300, -37.0470962993612005),
            (1e-10, -6.3613409024040566),
            (0.025, -1.9599639845400538),
            (0.975, 1.9599639845400534),
        ] {
            assert!(
                (qnorm(p) - q).abs() < 1e-13 * q.abs(),
                "qnorm({}) = {} want {}",
                p,
                qnorm(p),
                q
            );
        }
        assert_eq!(qnorm(0.5), 0.0);
    }

    #[test]
    fn pt_matches_r_including_its_normal_branch() {
        // 2*pt(-5, 1e6), 2*pt(-8.5, 123), 2*pt(-40, 30)
        for (t, df, want) in [
            (5.0, 1e6, 5.7339978708907352e-07),
            (8.5, 123.0, 5.2974594858603593e-14),
            (40.0, 30.0, 1.3726045194406362e-27),
        ] {
            let got = 2.0 * pt_upper(t, df);
            assert!(
                (got - want).abs() < 1e-9 * want,
                "t {} df {}: {} want {}",
                t,
                df,
                got,
                want
            );
        }
    }

    #[test]
    fn trigamma_is_double_precision() {
        for (x, want) in [
            (0.3, 12.24536454610773184),
            (2.0, 0.64493406684822641),
            (7.5, 0.14261589669670383),
        ] {
            assert!(
                (trigamma(x) - want).abs() < 1e-13 * want,
                "trigamma({}) = {}",
                x,
                trigamma(x)
            );
        }
    }

    #[test]
    fn fit_f_dist_matches_limma() {
        // fitFDist(c(0.5,1.2,0.8,2.5,0.3,1.1), df1=rep(6,6))
        let (s20, df0) = fit_f_dist(&[0.5, 1.2, 0.8, 2.5, 0.3, 1.1], &[6.0; 6]);
        assert!(
            (s20 - 0.95167499293493274).abs() < 1e-9 && (df0 - 14.415758042958757).abs() < 1e-7,
            "{} {}",
            s20,
            df0
        );
        // more than half exactly zero: limma carries on with a median of 1 rather than giving up
        let (s20, df0) = fit_f_dist(&[0.0, 0.0, 0.0, 0.5, 2.0], &[4.0; 5]);
        assert!(
            (s20 - 1.2086653401264773e-05).abs() < 1e-12 && (df0 - 0.32429870662766813).abs() < 1e-7,
            "{} {}",
            s20,
            df0
        );
    }

    #[test]
    fn an_uncovered_cell_is_d_zero_and_the_table_is_the_formula() {
        let lr = LogRatio::new();
        assert_eq!(lr.get(0.0, 0.0), 0.0);
        for (m, u) in [(3.0, 7.0), (255.0, 0.0), (300.0, 12.0)] {
            assert_eq!(lr.get(m, u), ((m + 0.5) / (u + 0.5)).log2());
        }
    }

    #[test]
    fn two_group_is_the_pooled_fit() {
        let (fc, s2) = two_group(&[1.0, 2.0, 3.0], &[0.0, 0.0, 2.0]);
        assert!((fc - (2.0 - 2.0 / 3.0)).abs() < 1e-15);
        // (1+0+1) + (4/9+4/9+16/9) over 4 df
        assert!((s2 - (2.0 + 24.0 / 9.0) / 4.0).abs() < 1e-15);
    }

    /* A region runs from its first significant row to its last and owns every row between them,
    significant or not; it ends at a gap over lambda and at a chromosome change. */
    #[test]
    fn segments_span_the_rows_between_and_break_on_gap_and_chromosome() {
        let cpgs: Vec<Cpg> = [100u32, 200, 300, 400, 2000, 2100, 50, 60]
            .iter()
            .map(|&p| cpg(p, 0.0, 1.0))
            .collect();
        let chrom_of = [0u16, 0, 0, 0, 0, 0, 1, 1];
        let sig = [true, false, false, true, true, true, true, true];
        let s = segment(&chrom_of, &sig, &cpgs, 1000.0);
        let got: Vec<(usize, usize)> = s.iter().map(|x| (x.lo, x.hi)).collect();
        assert_eq!(got, vec![(0, 3), (4, 5), (6, 7)]);
    }

    #[test]
    fn region_stats_are_over_the_whole_span_and_corrected_before_the_floor() {
        let mut cpgs: Vec<Cpg> = (0..4).map(|i| cpg(100 * (i + 1), 1.0 + i as f64, 1.0)).collect();
        cpgs.push(cpg(9000, -2.0, 1.0));
        let g = Genome {
            cpgs,
            chroms: vec![Chrom {
                name: "chr1".into(),
                lo: 0,
                hi: 5,
            }],
            global: GlobalBeta::default(),
        };
        let p = [0.01, 0.5, 0.2, 0.04, 0.3];
        let fdr = [1e-9, 1e-3, 1e-4, 1e-8, 1e-6];
        let segs = vec![Segment { chrom: 0, lo: 0, hi: 3 }, Segment { chrom: 0, lo: 4, hi: 4 }];
        let d = region_stats(&segs, &g, &p, &fdr, 2);
        assert_eq!(d.len(), 1, "the one-row region is dropped by the floor");
        assert_eq!(d[0].no_cpgs, 4);
        assert_eq!(d[0].min_smoothed_fdr, 1e-9);
        assert_eq!(d[0].meandiff, 2.5);
        assert_eq!(d[0].maxdiff, 4.0);
        // the harmonic mean of the span, then BH over BOTH regions: rank 1 of 2
        let hm = 4.0 / (1.0 / 0.01 + 1.0 / 0.5 + 1.0 / 0.2 + 1.0 / 0.04);
        let want = (hm * 2.0f64).min(0.3);
        assert!((d[0].hmfdr.unwrap() - want).abs() < 1e-15, "{:?}", d[0].hmfdr);
    }
}
