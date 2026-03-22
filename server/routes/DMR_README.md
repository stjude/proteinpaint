# DMR Analysis Pipeline

Differential Methylation Region (DMR) analysis for probe-level methylation array data.
Two backends are available: **Rust** (default, ~3s) and **R/DMRCate** (validation, ~30-60s).

## Pipeline Overview

```
HDF5 beta values (1M probes x 1544 samples)
    |
    v
Phase 1: Chromosome-chunked OLS (per-probe linear models)
    |   - Read 1000 probes at a time from HDF5
    |   - Beta -> M-value: M = log2(beta / (1 - beta)), clamped at [0.001, 0.999]
    |   - Filter: require ALL selected samples non-NaN, variance > 0
    |   - Two-group OLS: logFC = mean(case_M) - mean(control_M)
    |   - Residual variance: s^2 = (SS_case + SS_control) / (n1 + n2 - 2)
    v
Phase 2: Genome-wide Empirical Bayes (fitFDist)
    |   - Pool ~450K residual variances across all chromosomes
    |   - Estimate s0^2 and d0 via method-of-moments on log-variances
    |   - Moderated t-stat: t~ = logFC / (sqrt(s~^2) * stdev_unscaled)
    |   - P-values from Student's t with df = d_residual + d0
    |   - Genome-wide BH FDR correction
    v
Phase 3: Subset to query region (typically 4-30 probes in a promoter)
    |
    v
Phase 4: Kernel smoothing (Gaussian, lambda=1000bp)
    |   - Satterthwaite approximation for smoothed p-values
    |   - BH correction on smoothed p-values
    v
Phase 5: DMR segmentation
    |   - Group significant probes (per-CpG FDR < cutoff) within lambda bp
    |   - Require same direction of effect and min 2 CpGs
    |   - Fallback: if no DMRs from smoothing, use per-CpG FDR + delta-beta >= 0.05
    v
Phase 6: Diagnostic output (per-CpG beta means for scatter plot)
```

## Statistical Method

### Empirical Bayes Variance Moderation (Smyth 2004)

The key insight: per-probe linear model fits are independent OLS, but the variance
moderation borrows strength across ALL probes genome-wide. This requires two
hyperparameters estimated from the distribution of all ~450K probe variances:

```
z_g = log(s^2_g)                    # log-transformed sample variances

trigamma(d0/2) = Var(z) - trigamma(df/2)    # solve for d0 via Newton's method
log(s0^2) = mean(z) - digamma(df/2) + log(df/2) + digamma(d0/2) - log(d0/2)

s~^2_g = (d0 * s0^2 + df * s^2_g) / (d0 + df)    # moderated (posterior) variance
t~_g = logFC_g / (sqrt(s~^2_g) * sqrt(1/n1 + 1/n2))  # moderated t-statistic
p_g = 2 * P(T > |t~_g|) where T ~ t(df + d0)     # p-value
```

The `trigamma_inverse` function uses Newton's method with 8 iterations to match
limma's implementation. The derivative uses the recursion `psi_1(x) = psi_1(x+1) + 1/x^2`
to shift into the asymptotic range.

### Kernel Smoothing (Peters et al. 2015)

For each CpG in the query region, compute a Gaussian-weighted sum of squared
moderated t-statistics from neighboring CpGs:

```
S(i) = sum_j w(i,j) * t~_j^2    where w(i,j) = exp(-d^2 / (2*sigma^2))
sigma = lambda / C               (default: 1000/2 = 500bp)
```

The smoothed statistic is approximated as `S ~ a * chi^2(b)` via the Satterthwaite
method, matching the first two moments:

```
b = 2 * E[S]^2 / Var[S]    (degrees of freedom)
a = Var[S] / (2 * E[S])    (scale)
p = P(chi^2(b) > S/a)      (upper tail via survival function)
```

### DMR Segmentation

Uses per-CpG FDR (not smoothed FDR) for grouping — matching DMRCate's `is.sig` flag.
Smoothed FDR is attached as a region-level statistic (`min_smoothed_fdr`).

Proximity-based fallback (Karakachoff et al. 2021) applies when kernel smoothing
finds no DMRs: groups FDR-significant CpGs with |delta-beta| >= 0.05 within
lambda bp of each other, requiring same direction and min 2 CpGs.

## HDF5 Data Format

The probe-level beta value HDF5 file has this structure:

```
/beta/values              (n_probes, n_samples)  float32  - beta values matrix
/meta/samples/names       (n_samples,)           string   - sample identifiers
/meta/start               (n_probes,)            int64    - probe start positions
/meta/probe/probeID       (n_probes,)            string   - probe identifiers (e.g. cg12345678)
/ [attr] chrom_lengths    JSON string            - {"chr1": 94497, "chr2": 74660, ...}
```

**Important**: The `chrom_lengths` attribute defines the order of probes in the matrix.
Probes for chr1 occupy rows 0..94496, chr2 occupies rows 94497..169156, etc.
The JSON key order must be preserved (not sorted alphabetically) when parsing.

## Chromosome Chunking

To keep memory bounded (~6MB per chunk), the HDF5 matrix is read in chunks of
1000 probe rows at a time. Each chunk is a `(1000, n_total_samples)` f32 slice.
Only the selected case/control sample columns are extracted per probe.

Peak memory: ~130-170 MB (dominated by the collected ProbeStats vectors for ~450K probes).

## Input/Output JSON Contract

### Input (stdin)

```json
{
  "probe_h5_file": "/path/to/beta.h5",
  "chr": "chr14",
  "start": 100000,
  "stop": 105000,
  "case": "sample1,sample2,...",
  "control": "sample3,sample4,...",
  "fdr_cutoff": 0.05,
  "lambda": 1000,
  "C": 2,
  "min_delta_beta": 0.05,
  "min_samples_per_group": 3
}
```

### Output (stdout)

```json
{
  "dmrs": [{
    "chr": "chr14", "start": 100500, "stop": 101200,
    "no_cpgs": 5, "min_smoothed_fdr": 1.2e-10, "HMFDR": 3.4e-8,
    "maxdiff": 0.35, "meandiff": 0.28, "direction": "hyper",
    "overlapping_genes": null
  }],
  "diagnostic": {
    "probes": {
      "positions": [100500, 100650, ...],
      "mean_group1": [0.45, 0.52, ...],
      "mean_group2": [0.73, 0.80, ...],
      "fdr": [1.2e-10, 3.4e-8, ...],
      "logFC": [2.1, 1.8, ...]
    },
    "probe_spacings": [150, 200, ...],
    "total_probes_analyzed": 452453,
    "elapsed_ms": 2500,
    "peak_memory_mb": 132.0,
    "start_memory_mb": 5.0
  }
}
```

## R Validation Backend

`R/src/dmrcate_full.R` implements the same pipeline using R/limma/DMRCate for validation.
It runs synchronously (~30-60s) and produces identical output format.

To compare backends, use the toggle button in the DMR plot UI. The server logs
per-probe logFC and FDR values for both backends via `mayLog()`.

### Validated results (4 loci, G3G4-2 vs G3G4-5, panMB dataset)

| Locus | Probes | DMRs | logFC match | FDR match |
| --- | --- | --- | --- | --- |
| L1CAM (chrX) | 7 | 1 hyper | identical (4dp) | identical (4sf) |
| SSH2 (chr17) | 4 | 1 hyper | identical (4dp) | identical (4sf) |
| LRIG3 (chr12) | 15 (5 sig) | 1 hyper | identical (4dp) | identical (4sf) |
| COL17A1 (chr10) | 4 (3 sig) | 1 hyper | identical (4dp) | identical (4sf) |

## References

- Smyth GK (2004). "Linear models and empirical Bayes methods for assessing differential expression in microarray experiments." *Stat Appl Genet Mol Biol* 3(1), Article 3. doi:10.2202/1544-6115.1027
- Peters TJ et al. (2015). "De novo identification of differentially methylated regions in the human genome." *Epigenetics & Chromatin* 8:6. doi:10.1186/1756-8935-8-6
- Phipson B et al. (2016). "Robust hyperparameter estimation protects against hypervariable genes and improves power to detect differential expression." *Ann Appl Stat* 10(2):946-963. doi:10.1214/16-AOAS920
- Karakachoff M et al. (2021). "Epigenome-wide association studies: current knowledge, strategies and recommendations." *Clin Epigenetics* 13:214.
