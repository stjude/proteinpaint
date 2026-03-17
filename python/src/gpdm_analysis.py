"""
GPDM (Gaussian Process Differential Methylation) analysis for ProteinPaint.

This script is the entry point invoked by the ProteinPaint Node.js backend via
run_python(). It receives a JSON payload on stdin describing the analysis request,
runs the GPDM model, and writes a single JSON object to stdout.

stdin JSON fields:
    h5file      : str   — absolute path to the beta values HDF5 file
    chr         : str   — chromosome name (e.g. "chr7")
    start       : int   — region start coordinate (0-based)
    stop        : int   — region end coordinate
    group1      : list  — sample names for the reference group
    group2      : list  — sample names for the comparison group
    annotations : list  — optional annotation dicts with keys:
                          name, start, end, base_methylation, length_scale_bp
    priors_file : str   — optional path to precomputed priors JSON from
                          compute_methylation_priors.py (dataset-specific priors)
    nan_threshold: float — max fraction of NaN values to keep a probe (default 0.5)

stdout JSON fields:
    status      : "ok" on success (only present on success)
    dmrs        : list of annotation-aware DMR dicts
    metadata    : summary stats (probe counts, sample counts, region)
    error       : str — only present on failure; Node route handler checks this

HDF5 expected structure (same as query_beta_values.py):
    /beta/values             Dataset {n_sites, n_samples}
    /meta/probe/probeID      Dataset {n_sites}
    /meta/samples/col_idx    Dataset {n_samples}
    /meta/samples/names      Dataset {n_samples}
    /meta/start              Dataset {n_sites}
    chrom_lengths (root attribute): JSON map of chrom → n_sites

IMPORTANT — stderr constraint:
    run_python() in @sjcrh/proteinpaint-python rejects the process if it writes
    ANYTHING to stderr, and also rejects on any non-zero exit code. Therefore:
    - The GPDM logger is silenced before import (it uses logging → stderr)
    - All errors are caught and returned as {"error": "..."} in stdout JSON
    - sys.exit() is always called with 0
"""

import sys
import json
import logging
import numpy as np
import h5py

# Silence GPDM's logger so no INFO messages reach stderr.
# run_python() treats any stderr output as a fatal error.
logging.getLogger("gpdm").setLevel(logging.CRITICAL)

# Set matplotlib to non-interactive Agg backend before any plotting imports.
import matplotlib
matplotlib.use('Agg')

# Import the GPDM analysis class (now safe to import without stderr side-effects)
from gpdm import RegionalDMAnalysis

# Import Query from the existing PP HDF5 reader (same python/src/ directory)
from query_beta_values import Query


def get_region_positions(h5file, chrom, start, stop):
    """
    Read CpG genomic positions for a region from the HDF5 file.
    Query.process_genomic_queries() returns only the beta matrix, not positions,
    so this small helper reads just the meta/start array for the region.
    Uses the same boundary logic as Query to ensure row alignment.
    """
    with h5py.File(h5file, 'r') as f:
        chrom_lengths = json.loads(f['/'].attrs['chrom_lengths'])
        if chrom not in chrom_lengths:
            return None
        chroms = list(chrom_lengths.keys())
        prefix = [0]
        for c in chroms:
            prefix.append(prefix[-1] + chrom_lengths[c])
        idx = chroms.index(chrom)
        row_start = prefix[idx]
        start_pos = f['meta/start'][row_start:row_start + chrom_lengths[chrom]]
        left = int(np.searchsorted(start_pos, start, 'left'))
        right = int(np.searchsorted(start_pos, stop, 'right'))
        if left >= right:
            return None
        return start_pos[left:right]


def read_region_from_h5(h5file, samples, chrom, start, stop):
    """
    Read beta values for a genomic region from the ProteinPaint HDF5 format.

    The HDF5 stores data across all chromosomes in a flat array. The
    chrom_lengths root attribute encodes how many sites belong to each
    chromosome in order, allowing us to compute the per-chromosome row range
    via a prefix-sum. Within that range, binary search narrows to the query
    region.

    Parameters
    ----------
    h5file : str
        Path to the HDF5 file
    samples : list of str
        Sample names to retrieve (union of group1 + group2)
    chrom : str
        Chromosome name (e.g. "chr7")
    start, stop : int
        Genomic region bounds (start inclusive, stop exclusive)

    Returns
    -------
    positions : ndarray of shape (n_sites,) or None
        Genomic coordinates of CpG probes in the region
    beta_matrix : ndarray of shape (n_valid_samples, n_sites) or None
        Beta values; -1.0 sentinels replaced with NaN
    valid_samples : list of str
        Subset of `samples` that were actually found in the H5 file
        (some requested samples may be absent if not in this dataset)
    """
    with h5py.File(h5file, 'r') as f:
        # Read all sample names and their corresponding column indices in the
        # beta/values matrix. Not all samples are stored in column order —
        # col_idx maps name → actual column number.
        all_names = f['meta/samples/names'].asstr()[:]
        col_idx = f['meta/samples/col_idx'][:]

        # Build a lookup: sample name → integer column index in beta/values
        name_to_col = dict(zip(all_names, col_idx))

        # Only keep samples that actually exist in this H5 file
        valid_samples = [s for s in samples if s in name_to_col]
        if len(valid_samples) == 0:
            return None, None, []

        # Convert sample names to their integer column indices
        sample_cols = [int(name_to_col[s]) for s in valid_samples]

        # Parse the chrom_lengths root attribute (JSON string) to get the
        # number of probes per chromosome in the order they appear in the file
        chrom_lengths = json.loads(f['/'].attrs['chrom_lengths'])
        if chrom not in chrom_lengths:
            return None, None, []

        # Build a prefix-sum array to compute each chromosome's row range.
        # prefix[i] is the first row index for chroms[i];
        # prefix[i+1] is the first row index of the next chromosome.
        chroms = list(chrom_lengths.keys())
        prefix = [0]
        for c in chroms:
            prefix.append(prefix[-1] + chrom_lengths[c])

        chrom_idx = chroms.index(chrom)
        row_start = prefix[chrom_idx]      # first H5 row for this chromosome
        row_end = prefix[chrom_idx + 1]    # one past last H5 row for this chromosome

        # Read only this chromosome's positions (not the whole genome)
        chrom_pos = f['meta/start'][row_start:row_end]

        # Binary search within the chromosome's position array to find the
        # subarray that falls within [start, stop)
        left = int(np.searchsorted(chrom_pos, start))
        right = int(np.searchsorted(chrom_pos, stop, side='right'))

        if left >= right:
            # No probes in the requested region
            return None, None, []

        positions = chrom_pos[left:right]

        # Convert local (chromosome-relative) indices back to absolute H5 row indices
        abs_left = row_start + left
        abs_right = row_start + right

        # Slice the beta/values matrix: stored as (n_sites, n_samples), so
        # we first slice rows (sites), then select sample columns, then
        # transpose to get (n_valid_samples, n_sites)
        beta_slice = f['beta/values'][abs_left:abs_right, :]
        beta_matrix = beta_slice[:, sample_cols].T  # → (n_valid_samples, n_sites)

        # Cast to float64 for downstream computation, then convert the
        # ProteinPaint missing-data sentinel (-1.0) to NaN so numpy
        # statistics (nanmean, isnan) work correctly
        beta_matrix = beta_matrix.astype(np.float64)
        beta_matrix[beta_matrix < 0] = np.nan

        return positions, beta_matrix, valid_samples


def run_gpdm(params):
    """
    Execute the full GPDM analysis pipeline for a single genomic region.

    Pipeline steps:
    1. Read beta matrix from HDF5 for all requested samples
    2. Validate minimum sample and probe counts
    3. Drop probes with high NaN fraction (default > 50%)
    4. Impute remaining NaNs with per-group column means
    5. Initialize RegionalDMAnalysis and load the prepared data
    6. Add any caller-supplied annotations (from the ProteinPaint termdb)
    7. Run annotation-aware GP model
    8. Serialize results to a dict for JSON output

    Parameters
    ----------
    params : dict
        Parsed JSON from stdin (see module docstring for field descriptions)

    Returns
    -------
    dict
        On success: {status, dmrs, metadata}
        On failure: {error: str}
    """
    # Unpack required parameters
    h5file = params['h5file']
    chrom = params['chr']
    start = int(params['start'])
    stop = int(params['stop'])
    group1 = params['group1']   # list of sample name strings for reference group
    group2 = params['group2']   # list of sample name strings for comparison group

    # Optional parameters with sensible defaults
    nan_threshold = float(params.get('nan_threshold', 0.5))  # drop probes with > 50% missing
    annotations = params.get('annotations', [])               # regulatory domain annotations
    priors_file = params.get('priors_file', None)             # path to precomputed priors JSON

    # Read beta matrix and positions from HDF5
    # Note: Query.process_genomic_queries has a bug where it uses chromosome-local
    # row indices to slice the dataset instead of absolute row offsets, producing
    # wrong data for any chromosome other than the first. read_region_from_h5
    # correctly computes abs_left = row_start + left before slicing.
    all_samples = group1 + group2
    positions, beta_matrix, valid_samples = read_region_from_h5(
        h5file, all_samples, chrom, start, stop
    )

    if positions is None or len(positions) < 3:
        return {'error': f'Too few probes in {chrom}:{start}-{stop} (need >= 3)'}

    # Build a group label array aligned to valid_samples.
    # valid_samples is a subset of group1+group2 (some may be absent from H5),
    # so we re-derive group membership rather than assuming order is preserved.
    group1_set = set(group1)
    group2_set = set(group2)
    groups = np.array([
        'group1' if s in group1_set else 'group2'
        for s in valid_samples
    ])

    # Count how many valid samples we have per group
    n_g1 = int(np.sum(groups == 'group1'))
    n_g2 = int(np.sum(groups == 'group2'))

    # Require at least 3 samples per group so SE estimates are stable
    if n_g1 < 3 or n_g2 < 3:
        return {
            'error': f'Not enough samples with methylation data '
                     f'(group1={n_g1}, group2={n_g2}, need >= 3 each)'
        }

    # --- Step 1: NaN probe filtering ---
    # Compute per-probe NaN fraction across all samples (both groups combined).
    # Probes with too many missing values are uninformative and destabilize the GP.
    nan_frac = np.isnan(beta_matrix).mean(axis=0)
    keep = nan_frac <= nan_threshold          # boolean mask of probes to keep
    n_dropped = int(np.sum(~keep))            # count for metadata reporting
    positions = positions[keep]               # filter position array
    beta_matrix = beta_matrix[:, keep]        # filter beta matrix columns

    if len(positions) < 3:
        return {'error': f'Too few probes after NaN filtering (dropped {n_dropped})'}

    # --- Step 2: Per-group mean imputation for remaining NaNs ---
    # After probe filtering, individual sample-probe NaNs may remain.
    # Replace them with the per-group column mean so the GP sees a complete
    # matrix. This is a simple but effective imputation for the few remaining
    # missing values (those that survived the nan_threshold filter).
    nan_count = int(np.isnan(beta_matrix).sum())  # total NaNs before imputation (for metadata)
    if nan_count > 0:
        # Drop probes that are all-NaN in either group to avoid RuntimeWarnings
        # from nanmean (which would write to stderr and break run_python())
        keep = np.ones(beta_matrix.shape[1], dtype=bool)
        for grp in ('group1', 'group2'):
            mask = groups == grp
            all_nan = np.all(np.isnan(beta_matrix[mask, :]), axis=0)
            keep &= ~all_nan
        if not np.all(keep):
            beta_matrix = beta_matrix[:, keep]
            positions = positions[keep]

        # Impute remaining per-sample NaNs with per-group column mean
        for grp in ('group1', 'group2'):
            mask = groups == grp
            grp_data = beta_matrix[mask, :]
            grp_means = np.nanmean(grp_data, axis=0)
            for j in range(grp_data.shape[1]):
                nans = np.isnan(grp_data[:, j])
                if np.any(nans):
                    grp_data[nans, j] = grp_means[j]
            beta_matrix[mask, :] = grp_data

    # --- Step 3: Load required dataset-specific priors ---
    if not priors_file:
        return {'error': 'priors_file is required. Run compute_methylation_priors.py to generate it.'}

    try:
        with open(priors_file, 'r') as pf:
            priors_data = json.load(pf)
            dataset_priors = priors_data.get('priors', None)
    except (IOError, json.JSONDecodeError) as exc:
        return {'error': f'Failed to read priors file ({priors_file}): {exc}'}

    if not dataset_priors:
        return {'error': f'Priors file ({priors_file}) has no "priors" key or is empty.'}

    # --- Step 4: Initialize GPDM analysis object ---
    analysis = RegionalDMAnalysis(
        chrom=chrom, start=start, end=stop,
        dataset_priors=dataset_priors,
    )

    # Load the cleaned beta matrix; explicitly name groups for logging
    analysis.load_methylation(
        positions=positions.astype(float),
        beta_values=beta_matrix,
        groups=groups,
        group_A='group1',
        group_B='group2',
    )

    # --- Step 5: Add caller-supplied annotations ---
    # Annotations come from the server's regulatory annotation query (CpG islands,
    # ENCODE cCREs) and optionally from the client. The annotation name triggers
    # type-matching in add_annotation(), which looks up the prior from the
    # dataset priors file. Only pass explicit base_methylation/length_scale
    # if the caller provided them, so we don't override the dataset priors.
    for ann in annotations:
        analysis.add_annotation(
            ann['name'],
            int(ann['start']),
            int(ann['end']),
            base_methylation=ann.get('base_methylation'),
            length_scale_bp=ann.get('length_scale_bp'),
        )

    # --- Step 6: Run annotation-aware GP model ---
    analysis.run()

    # --- Step 7: Serialize annotation-aware DMRs ---
    # max_delta_beta is always positive (absolute peak effect size).
    # mean_delta_beta is signed: positive = group B (group2) > group A (group1) = hyper.
    dmrs = []
    if analysis.results_annotation and analysis.results_annotation.dmrs:
        for d in analysis.results_annotation.dmrs:
            dmrs.append({
                'chr': chrom,
                'start': int(d.start),
                'stop': int(d.end),
                'width': int(d.width_bp),
                'max_delta_beta': float(d.max_delta_beta),
                'direction': 'hyper' if d.mean_delta_beta >= 0 else 'hypo',
                'probability': float(d.mean_posterior_prob),
            })

    # --- Step 8: Build diagnostic data (raw probes vs GP posterior) ---
    r = analysis.results_annotation
    mask_g1 = groups == 'group1'
    mask_g2 = groups == 'group2'

    # Per-probe raw group means
    raw_mean_g1 = beta_matrix[mask_g1].mean(axis=0)
    raw_mean_g2 = beta_matrix[mask_g2].mean(axis=0)

    # Domain info with learned kernel params
    domains = []
    for ann in analysis.annotations:
        ann_type = ann.name.split('_')[0] if '_' in ann.name else ann.name
        learned = r.learned_params.get(ann.name, {})
        domains.append({
            'name': ann.name,
            'type': ann_type,
            'start': int(ann.start),
            'end': int(ann.end),
            'prior_mean': float(ann.base_methylation),
            'prior_ls': float(learned.get('hint_ls_bp', ann.length_scale_bp)),
            'learned_ls': float(learned['learned_ls_bp']) if learned.get('learned_ls_bp') else None,
        })

    # Probe gap analysis
    spacings = np.diff(positions).tolist() if len(positions) > 1 else []

    return {
        'status': 'ok',
        'dmrs': dmrs,
        'metadata': {
            'n_probes': int(len(positions)),
            'n_probes_dropped': n_dropped,
            'n_nan_imputed': nan_count,
            'n_samples_group1': n_g1,
            'n_samples_group2': n_g2,
            'region': f'{chrom}:{start}-{stop}',
        },
        'diagnostic': {
            'probes': {
                'positions': positions.tolist(),
                'mean_group1': raw_mean_g1.tolist(),
                'mean_group2': raw_mean_g2.tolist(),
            },
            'gp_posterior': {
                'grid': r.grid_positions.tolist(),
                'pred_group1': r.pred_A.tolist(),
                'pred_group2': r.pred_B.tolist(),
                'std_group1': r.std_A.tolist(),
                'std_group2': r.std_B.tolist(),
                'diff_mean': r.diff_mean.tolist(),
                'ci_lower': r.ci_lower.tolist(),
                'ci_upper': r.ci_upper.tolist(),
            },
            'domains': domains,
            'probe_spacings': spacings,
        }
    }


class NumpyEncoder(json.JSONEncoder):
    """
    Custom JSON encoder to handle numpy scalar and array types.

    Python's standard json module does not know how to serialize numpy types
    (np.int64, np.float32, ndarray, etc.), which are produced throughout the
    GPDM pipeline. This encoder extends the default to handle them gracefully.

    Conversions:
    - np.integer subtypes → Python int
    - np.floating subtypes → Python float (NaN/Inf → None / JSON null)
    - np.ndarray → Python list (via .tolist())
    - All other types fall through to the default encoder
    """
    def default(self, obj):
        if isinstance(obj, (np.integer,)):
            # Covers np.int8, np.int16, np.int32, np.int64, np.uint*, etc.
            return int(obj)
        if isinstance(obj, (np.floating,)):
            # JSON has no NaN or Infinity literals; convert to null
            if np.isnan(obj) or np.isinf(obj):
                return None
            return float(obj)
        if isinstance(obj, np.ndarray):
            # Recursively convert array elements (each will pass through default() again)
            return obj.tolist()
        # Delegate to the base class for all other types (raises TypeError if unknown)
        return super().default(obj)


if __name__ == '__main__':
    # Entry point when called by run_python() from the ProteinPaint Node backend.
    #
    # Contract with run_python():
    #   - Read all input from stdin as a single JSON string
    #   - Write exactly one JSON object to stdout
    #   - Write NOTHING to stderr (any stderr causes run_python to reject the result)
    #   - Always exit with code 0 (non-zero exit causes run_python to reject the result)
    #
    # Errors are communicated as {"error": "message"} in the JSON stdout so the
    # Node route handler (termdb.dmr.ts) can surface them to the client.
    try:
        # Read the complete stdin payload (run_python pipes the request body here)
        input_data = sys.stdin.read()

        if not input_data.strip():
            # Guard against being called with no input (e.g. during testing)
            print(json.dumps({'error': 'No input received on stdin'}))
            sys.exit(0)

        # Parse the JSON request body
        params = json.loads(input_data)

        # Run the analysis and serialize the result
        result = run_gpdm(params)
        print(json.dumps(result, cls=NumpyEncoder))

    except Exception as e:
        # Catch-all: any unexpected exception (bad JSON, missing H5 key, etc.)
        # is returned as an error JSON rather than letting the process crash
        # with a non-zero exit code or stderr output.
        import traceback
        print(json.dumps({'error': f'{str(e)}\n{traceback.format_exc()}'}))
    # Implicit sys.exit(0) — always exits cleanly
