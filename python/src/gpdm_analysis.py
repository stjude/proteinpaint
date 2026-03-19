"""
GPDM analysis entry point for ProteinPaint.

Reads a JSON payload from stdin, runs the GP differential methylation model,
and writes a single JSON object to stdout.

stdin fields: h5file, chr, start, stop, group1, group2, annotations,
              priors_file, nan_threshold, width, trackHeight, group1Name,
              group2Name, colors (optional: {group1, group2, hyper, hypo})
"""

import sys
import json
import logging
import io
import base64
import numpy as np
import h5py

logging.getLogger("gpdm").setLevel(logging.CRITICAL)

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from gpdm import run_dmr



def read_region_from_h5(h5file, samples, chrom, start, stop):
    """Read beta values for a genomic region from the ProteinPaint HDF5 format."""
    with h5py.File(h5file, 'r') as f:
        all_names = f['meta/samples/names'].asstr()[:]
        col_idx = f['meta/samples/col_idx'][:]
        name_to_col = dict(zip(all_names, col_idx))

        valid_samples = [s for s in samples if s in name_to_col]
        if not valid_samples:
            return None, None, []

        sample_cols = [int(name_to_col[s]) for s in valid_samples]

        chrom_lengths = json.loads(f['/'].attrs['chrom_lengths'])
        if chrom not in chrom_lengths:
            return None, None, []

        chroms = list(chrom_lengths.keys())
        prefix = [0]
        for c in chroms:
            prefix.append(prefix[-1] + chrom_lengths[c])

        chrom_idx = chroms.index(chrom)
        row_start = prefix[chrom_idx]
        chrom_pos = f['meta/start'][row_start:prefix[chrom_idx + 1]]

        left = int(np.searchsorted(chrom_pos, start))
        right = int(np.searchsorted(chrom_pos, stop, side='right'))
        if left >= right:
            return None, None, []

        positions = chrom_pos[left:right]
        beta_slice = f['beta/values'][row_start + left:row_start + right, :]
        beta_matrix = beta_slice[:, sample_cols].T.astype(np.float64)
        beta_matrix[beta_matrix < 0] = np.nan

        return positions, beta_matrix, valid_samples


def generate_track_png(diagnostic, dmrs, view_start, view_stop, width_px, height_px, colors, dpi, y_pad):
    """Render the GP Model as a PNG for embedding as a bigwig imgData track."""
    fig = plt.figure(figsize=(width_px / dpi, height_px / dpi), dpi=dpi)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(view_start, view_stop)
    ax.set_ylim(-y_pad, 1 + y_pad)
    ax.axis('off')

    probes = diagnostic['probes']
    gp = diagnostic['gp_posterior']
    pos = np.array(probes['positions'])
    grid = np.array(gp['grid'])

    for dmr in dmrs:
        color = colors['hyper'] if dmr['direction'] == 'hyper' else colors['hypo']
        ax.axvspan(dmr['start'], dmr['stop'], alpha=0.06, color=color)

    for pred_key, std_key, color in [
        ('pred_group1', 'std_group1', colors['hypo']),
        ('pred_group2', 'std_group2', colors['hyper']),
    ]:
        pred = np.array(gp[pred_key])
        std = np.array(gp[std_key])
        ax.fill_between(grid, np.clip(pred - 1.96 * std, 0, 1), np.clip(pred + 1.96 * std, 0, 1),
                        color=color, alpha=0.1)

    ax.plot(grid, gp['pred_group1'], '-', color=colors['group1'], lw=1.5)
    ax.plot(grid, gp['pred_group2'], '-', color=colors['group2'], lw=1.5)
    ax.scatter(pos, probes['mean_group1'], s=6, color=colors['hypo'], alpha=0.6, zorder=3)
    ax.scatter(pos, probes['mean_group2'], s=6, color=colors['hyper'], alpha=0.6, zorder=3)

    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=dpi, pad_inches=0, transparent=True)
    plt.close(fig)
    buf.seek(0)
    return f'data:image/png;base64,{base64.b64encode(buf.getvalue()).decode("ascii")}'


def run_gpdm(params):
    h5file = params['h5file']
    chrom = params['chr']
    start = int(params['start'])
    stop = int(params['stop'])
    group1 = params['group1']
    group2 = params['group2']
    nan_threshold = float(params.get('nan_threshold'))
    annotations = params.get('annotations')
    priors_file = params.get('priors_file')

    positions, beta_matrix, valid_samples = read_region_from_h5(
        h5file, group1 + group2, chrom, start, stop
    )

    if positions is None or len(positions) < 3:
        return {'error': f'Too few probes in {chrom}:{start}-{stop} (need >= 3)'}

    group1_set = set(group1)
    groups = np.array(['group1' if s in group1_set else 'group2' for s in valid_samples])
    n_g1 = int(np.sum(groups == 'group1'))
    n_g2 = int(np.sum(groups == 'group2'))

    if n_g1 < 3 or n_g2 < 3:
        return {'error': f'Not enough samples with methylation data (group1={n_g1}, group2={n_g2}, need >= 3 each)'}

    # Drop probes with too many missing values
    nan_frac = np.isnan(beta_matrix).mean(axis=0)
    keep = nan_frac <= nan_threshold
    n_dropped = int(np.sum(~keep))
    positions = positions[keep]
    beta_matrix = beta_matrix[:, keep]

    if len(positions) < 3:
        return {'error': f'Too few probes after NaN filtering (dropped {n_dropped})'}

    # Impute remaining NaNs with per-group column means
    nan_count = int(np.isnan(beta_matrix).sum())
    if nan_count > 0:
        # Drop probes all-NaN in either group to avoid nanmean warnings to stderr
        keep = np.ones(beta_matrix.shape[1], dtype=bool)
        for grp in ('group1', 'group2'):
            keep &= ~np.all(np.isnan(beta_matrix[groups == grp, :]), axis=0)
        if not np.all(keep):
            beta_matrix = beta_matrix[:, keep]
            positions = positions[keep]

        for grp in ('group1', 'group2'):
            mask = groups == grp
            grp_data = beta_matrix[mask, :]
            grp_means = np.nanmean(grp_data, axis=0)
            for j in range(grp_data.shape[1]):
                nans = np.isnan(grp_data[:, j])
                if np.any(nans):
                    grp_data[nans, j] = grp_means[j]
            beta_matrix[mask, :] = grp_data

    if not priors_file:
        return {'error': 'priors_file is required. Run compute_methylation_priors.py to generate it.'}

    try:
        with open(priors_file, 'r') as pf:
            dataset_priors = json.load(pf).get('priors')
    except (IOError, json.JSONDecodeError) as exc:
        return {'error': f'Failed to read priors file: {exc}'}

    if not dataset_priors:
        return {'error': 'Priors file has no "priors" key or is empty'}

    r = run_dmr(chrom, start, stop, positions.astype(float), beta_matrix, groups,
                annotations, dataset_priors, group_A='group1', group_B='group2')

    dmrs = [{
        'chr': chrom,
        'start': int(d.start),
        'stop': int(d.end),
        'width': int(d.width_bp),
        'max_delta_beta': float(d.max_delta_beta),
        'direction': 'hyper' if d.mean_delta_beta >= 0 else 'hypo',
        'probability': float(d.mean_posterior_prob),
    } for d in (r.dmrs or [])]

    mask_g1 = groups == 'group1'
    mask_g2 = groups == 'group2'

    domains = []
    for ann in r.annotations:
        learned = r.learned_params.get(ann.name, {})
        domains.append({
            'name': ann.name,
            'type': ann.name.split('_')[0] if '_' in ann.name else ann.name,
            'start': int(ann.start),
            'end': int(ann.end),
            'prior_mean': float(ann.base_methylation),
            'prior_ls': float(learned.get('hint_ls_bp', ann.length_scale_bp)),
            'learned_ls': float(learned['learned_ls_bp']) if learned.get('learned_ls_bp') else None,
        })

    diagnostic = {
        'probes': {
            'positions': positions.tolist(),
            'mean_group1': beta_matrix[mask_g1].mean(axis=0).tolist(),
            'mean_group2': beta_matrix[mask_g2].mean(axis=0).tolist(),
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
        'probe_spacings': np.diff(positions).tolist() if len(positions) > 1 else [],
    }

    result = {
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
        'diagnostic': diagnostic,
    }

    width_px = params.get('width')
    height_px = params.get('trackHeight')
    if width_px and height_px:
        result['trackImg'] = generate_track_png(
            diagnostic, dmrs, start, stop, int(width_px), int(height_px),
            params.get('colors'), params.get('trackDpi'), params.get('trackYPad')
        )

    return result


def numpy_default(obj):
    if isinstance(obj, np.integer): return int(obj)
    if isinstance(obj, np.floating): return None if (np.isnan(obj) or np.isinf(obj)) else float(obj)
    if isinstance(obj, np.ndarray): return obj.tolist()
    raise TypeError(f'Object of type {type(obj)} is not JSON serializable')


try:
    input_data = sys.stdin.read()
    if not input_data.strip():
        print(json.dumps({'error': 'No input received on stdin'}))
        sys.exit(0)
    result = run_gpdm(json.loads(input_data))
    print(json.dumps(result, default=numpy_default))
except Exception as e:
    import traceback
    print(json.dumps({'error': f'{str(e)}\n{traceback.format_exc()}'}))
