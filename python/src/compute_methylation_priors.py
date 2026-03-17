"""
Precompute empirical methylation priors per regulatory annotation type.

This script reads the full DNA methylation H5 file and tabix-indexed
regulatory annotation BED files, then computes dataset-specific priors:

  1. Mean beta value per annotation type (CGI, Shore, Promoter, Enhancer,
     CTCF, Gene body, Intergenic) — used as the GP mean function
  2. Empirical length scale per annotation type — estimated via Empirical
     Bayes (Type II ML): fits Matern(2.5) GPs to many representative
     domains and extracts the marginal-likelihood-optimized length scale

Output is a JSON file that the GPDM analysis pipeline loads at query time,
providing data-grounded values for the GPDM analysis (required).

Usage:
    python compute_methylation_priors.py \\
        --h5 /path/to/dnaMeth.h5 \\
        --cpg-islands /path/to/anno/cpgIsland.hg38.gz \\
        --encode-ccre /path/to/anno/encodeCCRE.hg38.gz \\
        --output /path/to/dnaMeth.priors.json \\
        [--max-sites-per-type 50000] \\
        [--n-samples 100]

The script samples up to --n-samples samples (default: 100) and up to
--max-sites-per-type probes per annotation type (default: 50000) to keep
runtime manageable on large datasets.
"""

import argparse
import json
import subprocess
import sys
import warnings

import h5py
import numpy as np
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import Matern, WhiteKernel

warnings.filterwarnings("ignore")

# ---------------------------------------------------------------
# ENCODE cCRE classification → GPDM annotation type
# ---------------------------------------------------------------
CCRE_TYPE_MAP = {
    "prom": "Promoter",
    "enhp": "Enhancer",
    "enhd": "Enhancer",
    "ctcf-only": "CTCF",
    "ctcf-bound": "CTCF",
    "k4m3": "Promoter",
    "pls": "Promoter",
    "pels": "Enhancer",
    "dels": "Enhancer",
    "dnase-h3k4me3": "Promoter",
}


def map_ccre_type(classification):
    lower = classification.lower().strip()
    for key, ann_type in CCRE_TYPE_MAP.items():
        if key in lower:
            return ann_type
    return None


# ---------------------------------------------------------------
# Read H5 metadata
# ---------------------------------------------------------------
def read_h5_metadata(h5file):
    """Return chrom_lengths dict, all positions array, and sample info."""
    with h5py.File(h5file, "r") as f:
        chrom_lengths = json.loads(f["/"].attrs["chrom_lengths"])
        all_positions = f["meta/start"][:]
        n_samples = f["beta/values"].shape[1]
        sample_names = f["meta/samples/names"].asstr()[:]
    return chrom_lengths, all_positions, n_samples, sample_names


def get_chrom_ranges(chrom_lengths):
    """Compute prefix-sum row ranges for each chromosome."""
    chroms = list(chrom_lengths.keys())
    prefix = [0]
    for c in chroms:
        prefix.append(prefix[-1] + chrom_lengths[c])
    ranges = {}
    for i, c in enumerate(chroms):
        ranges[c] = (prefix[i], prefix[i + 1])
    return ranges


# ---------------------------------------------------------------
# Query tabix annotation files
# ---------------------------------------------------------------
def query_tabix(bed_file, chrom, start, stop):
    """Query a tabix file and return raw lines."""
    region = f"{chrom}:{start}-{stop}"
    try:
        result = subprocess.run(
            ["tabix", bed_file, region],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            return []
        return [l for l in result.stdout.strip().split("\n") if l]
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return []


def parse_cpg_islands(lines):
    """Parse CpG Island BED lines → list of (start, end, type)."""
    annotations = []
    for line in lines:
        cols = line.split("\t")
        if len(cols) < 3:
            continue
        s, e = int(cols[1]), int(cols[2])
        annotations.append((s, e, "CGI"))
        # Derive shores (2kb flanking)
        annotations.append((max(0, s - 2000), s, "Shore"))
        annotations.append((e, e + 2000, "Shore"))
    return annotations


def parse_encode_ccre(lines):
    """Parse ENCODE cCRE BED lines → list of (start, end, type)."""
    annotations = []
    for line in lines:
        cols = line.split("\t")
        if len(cols) < 5:
            continue
        s, e = int(cols[1]), int(cols[2])
        class_col = cols[5] if len(cols) >= 6 else cols[4]
        # Handle comma-separated classifications
        ann_type = None
        for part in class_col.split(","):
            ann_type = map_ccre_type(part)
            if ann_type:
                break
        if ann_type:
            annotations.append((s, e, ann_type))
    return annotations


# ---------------------------------------------------------------
# Classify probes by annotation type
# ---------------------------------------------------------------
def classify_probes(positions, chrom_ranges, cpg_island_file, encode_ccre_file):
    """
    For each probe position, determine which annotation type it falls in.
    Returns a dict mapping annotation type → array of row indices into the H5.
    """
    # Build a per-probe type label array
    n_probes = len(positions)
    probe_types = np.full(n_probes, "Intergenic", dtype=object)

    # Major chromosomes only (skip alt/random)
    major_chroms = [c for c in chrom_ranges if not ("_" in c or c == "chrM")]

    for chrom in major_chroms:
        row_start, row_end = chrom_ranges[chrom]
        if row_end <= row_start:
            continue

        chrom_pos = positions[row_start:row_end]
        if len(chrom_pos) == 0:
            continue
        chrom_start = int(chrom_pos[0])
        chrom_end = int(chrom_pos[-1]) + 1

        # Collect all annotations for this chromosome
        annotations = []
        if cpg_island_file:
            lines = query_tabix(cpg_island_file, chrom, chrom_start, chrom_end)
            annotations.extend(parse_cpg_islands(lines))
        if encode_ccre_file:
            lines = query_tabix(encode_ccre_file, chrom, chrom_start, chrom_end)
            annotations.extend(parse_encode_ccre(lines))

        if not annotations:
            continue

        # For each annotation, label the probes that fall within it.
        # Priority: specific types override Intergenic (already default).
        # Among specific types, later annotations overwrite earlier ones,
        # but this is fine — overlapping regions are rare and the priors
        # for overlapping types are similar.
        for ann_start, ann_end, ann_type in annotations:
            # Binary search for probes in [ann_start, ann_end)
            left = np.searchsorted(chrom_pos, ann_start, side="left")
            right = np.searchsorted(chrom_pos, ann_end, side="right")
            if left < right:
                abs_left = row_start + left
                abs_right = row_start + right
                probe_types[abs_left:abs_right] = ann_type

        print(f"  {chrom}: classified {row_end - row_start} probes", flush=True)

    return probe_types


# ---------------------------------------------------------------
# Compute empirical priors
# ---------------------------------------------------------------
def compute_priors(h5file, probe_types, n_probes, n_samples_to_use,
                   max_sites_per_type, sample_names):
    """
    Compute mean methylation and empirical length scale per annotation type.

    For each type:
    - Sample up to max_sites_per_type probes of that type
    - Read beta values for a random subset of samples
    - Compute mean beta (the empirical prior)
    - Estimate length scale via marginal likelihood (Empirical Bayes)
    """
    types_present = set(probe_types)
    # Select a random subset of samples for efficiency
    n_total_samples = len(sample_names)
    n_use = min(n_samples_to_use, n_total_samples)
    sample_indices = np.sort(
        np.random.default_rng(42).choice(n_total_samples, size=n_use, replace=False)
    )

    priors = {}

    with h5py.File(h5file, "r") as f:
        all_positions = f["meta/start"][:]
        beta_ds = f["beta/values"]

        for ann_type in sorted(types_present):
            type_mask = probe_types == ann_type
            type_indices = np.where(type_mask)[0]
            n_type = len(type_indices)

            if n_type < 10:
                print(f"  {ann_type}: {n_type} probes (too few, skipping)")
                continue

            # Subsample probes if too many
            if n_type > max_sites_per_type:
                rng = np.random.default_rng(hash(ann_type) % 2**32)
                type_indices = np.sort(
                    rng.choice(type_indices, size=max_sites_per_type, replace=False)
                )
                n_type = max_sites_per_type

            # Read beta values for these probes × sampled samples
            # H5 is (n_sites, n_samples), need to read row-by-row for
            # non-contiguous indices. Batch into chunks for efficiency.
            positions_subset = all_positions[type_indices]

            # Read in chunks of 5000 rows to balance memory and I/O
            chunk_size = 5000
            all_betas = []
            for i in range(0, n_type, chunk_size):
                chunk_idx = type_indices[i:i + chunk_size]
                # For non-contiguous rows, read the spanning range then select
                lo, hi = int(chunk_idx[0]), int(chunk_idx[-1]) + 1
                slab = beta_ds[lo:hi, :][:, sample_indices]
                # Select only the rows we want from the slab
                local_idx = chunk_idx - lo
                all_betas.append(slab[local_idx])

            beta_matrix = np.vstack(all_betas).astype(np.float64)
            # Replace sentinel -1 with NaN
            beta_matrix[beta_matrix < 0] = np.nan

            # Compute mean beta across all samples and probes
            mean_beta = float(np.nanmean(beta_matrix))

            # Compute per-probe mean across samples
            probe_means = np.nanmean(beta_matrix, axis=1)
            valid = ~np.isnan(probe_means)
            probe_means = probe_means[valid]
            positions_valid = positions_subset[valid]

            # Estimate length scale via empirical Bayes (marginal likelihood)
            ls_result = estimate_length_scale(positions_valid, probe_means)

            priors[ann_type] = {
                "base_methylation": round(mean_beta, 4),
                "length_scale_bp": round(ls_result["length_scale_bp"], 0),
                "ls_p10": round(ls_result["ls_p10"], 0),
                "ls_p90": round(ls_result["ls_p90"], 0),
                "n_probes": int(n_type),
                "n_domains_fitted": ls_result["n_domains_fitted"],
            }
            print(
                f"  {ann_type:12s}: mean_beta={mean_beta:.4f}, "
                f"ls={ls_result['length_scale_bp']:.0f}bp "
                f"[p10={ls_result['ls_p10']:.0f}, p90={ls_result['ls_p90']:.0f}], "
                f"n_domains={ls_result['n_domains_fitted']}, "
                f"n_probes={n_type}",
                flush=True,
            )

    return priors


def estimate_length_scale(positions, values, n_domains=75,
                          min_probes_per_domain=5, gap_threshold=5000):
    """
    Estimate the Matern length-scale via Empirical Bayes (Type II ML).

    Instead of a variogram heuristic, this fits Matern(2.5) GPs to many
    representative domains of the same annotation type across the genome and
    extracts the optimizer's maximum-marginal-likelihood length scale from
    each. The distribution of learned length scales gives a principled
    prior: the median is the point estimate, and the 10th/90th percentiles
    define optimizer bounds for query-time fitting.

    Steps:
    1. Segment probes into contiguous domains (split at gaps > gap_threshold)
    2. Sample up to n_domains domains with >= min_probes_per_domain probes
    3. Fit a Matern(2.5) + WhiteKernel GP to each domain
    4. Collect optimized length scales, return median and percentiles

    Returns dict with keys: length_scale_bp, ls_p10, ls_p90, n_domains_fitted.
    Falls back to 500bp if insufficient data.
    """
    fallback = {"length_scale_bp": 500.0, "ls_p10": 150.0, "ls_p90": 2000.0,
                "n_domains_fitted": 0}

    if len(positions) < 20:
        return fallback

    # Sort by position
    order = np.argsort(positions)
    positions = positions[order]
    values = values[order]

    # --- Step 1: Segment into contiguous domains ---
    gaps = np.diff(positions)
    split_indices = np.where(gaps > gap_threshold)[0] + 1
    segments = np.split(np.arange(len(positions)), split_indices)

    # Filter to domains with enough probes
    valid_segments = [seg for seg in segments if len(seg) >= min_probes_per_domain]
    if len(valid_segments) < 5:
        return fallback

    # --- Step 2: Sample domains ---
    rng = np.random.default_rng(42)
    if len(valid_segments) > n_domains:
        chosen = rng.choice(len(valid_segments), size=n_domains, replace=False)
        valid_segments = [valid_segments[i] for i in chosen]

    # --- Step 3: Fit a GP to each domain ---
    learned_ls_values = []

    for seg in valid_segments:
        pos_dom = positions[seg]
        val_dom = values[seg]
        domain_span = pos_dom[-1] - pos_dom[0]

        if domain_span < 20:
            continue

        # Normalize positions to [0, 1]
        X_norm = ((pos_dom - pos_dom[0]) / domain_span).reshape(-1, 1)
        # Fit residuals relative to domain mean
        prior = float(np.mean(val_dom))
        residuals = val_dom - prior

        # Broad bounds so the optimizer can explore freely
        kernel = (
            1.0 * Matern(length_scale=0.2, nu=2.5,
                          length_scale_bounds=(0.01, 1.0))
            + WhiteKernel(noise_level=0.001,
                          noise_level_bounds=(1e-6, 0.1))
        )

        gp = GaussianProcessRegressor(
            kernel=kernel, n_restarts_optimizer=3,
            alpha=1e-4, normalize_y=False,
        )

        try:
            gp.fit(X_norm, residuals)
            # Extract learned length scale (fraction of domain)
            k_params = gp.kernel_.k1.get_params()
            ls_frac = k_params.get("k2__length_scale", None)
            if ls_frac is None:
                continue
            # Discard if optimizer hit the boundary (uninformative)
            if ls_frac <= 0.012 or ls_frac >= 0.98:
                continue
            ls_bp = ls_frac * domain_span
            learned_ls_values.append(ls_bp)
        except Exception:
            continue

    # --- Step 4: Aggregate ---
    if len(learned_ls_values) < 5:
        return fallback

    arr = np.array(learned_ls_values)
    return {
        "length_scale_bp": float(np.median(arr)),
        "ls_p10": float(np.percentile(arr, 10)),
        "ls_p90": float(np.percentile(arr, 90)),
        "n_domains_fitted": len(arr),
    }


# ---------------------------------------------------------------
# Main
# ---------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Precompute empirical methylation priors per annotation type"
    )
    parser.add_argument("--h5", required=True, help="Path to dnaMeth.h5")
    parser.add_argument("--cpg-islands", default=None,
                        help="Tabix-indexed CpG island BED file")
    parser.add_argument("--encode-ccre", default=None,
                        help="Tabix-indexed ENCODE cCRE BED file")
    parser.add_argument("--output", required=True,
                        help="Output JSON file path")
    parser.add_argument("--max-sites-per-type", type=int, default=50000,
                        help="Max probes to sample per annotation type")
    parser.add_argument("--n-samples", type=int, default=100,
                        help="Number of samples to use for computing means")

    args = parser.parse_args()

    if not args.cpg_islands and not args.encode_ccre:
        print("ERROR: At least one of --cpg-islands or --encode-ccre is required",
              file=sys.stderr)
        sys.exit(1)

    print(f"Reading H5 metadata from {args.h5}...", flush=True)
    chrom_lengths, all_positions, n_samples, sample_names = read_h5_metadata(args.h5)
    chrom_ranges = get_chrom_ranges(chrom_lengths)
    n_probes = len(all_positions)
    print(f"  {n_probes:,} probes, {n_samples} samples, "
          f"{len(chrom_lengths)} chromosomes", flush=True)

    print("\nClassifying probes by annotation type...", flush=True)
    probe_types = classify_probes(
        all_positions, chrom_ranges,
        args.cpg_islands, args.encode_ccre
    )

    # Summary of classification
    unique_types, counts = np.unique(probe_types, return_counts=True)
    print("\nProbe classification summary:")
    for t, c in sorted(zip(unique_types, counts), key=lambda x: -x[1]):
        print(f"  {t:12s}: {c:>8,} probes ({100*c/n_probes:.1f}%)")

    print("\nComputing empirical priors...", flush=True)
    priors = compute_priors(
        args.h5, probe_types, n_probes,
        args.n_samples, args.max_sites_per_type,
        sample_names,
    )

    # Write output
    output = {
        "description": "Empirical methylation priors computed from dataset",
        "h5file": args.h5,
        "n_probes_total": int(n_probes),
        "n_samples_total": int(n_samples),
        "priors": priors,
    }

    with open(args.output, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nPriors written to {args.output}")


if __name__ == "__main__":
    main()
