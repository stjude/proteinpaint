"""
GPDM Diagnostic — raw probes vs GP posterior visualization.

Runs the same GPDM pipeline as gpdm_analysis.py but additionally exports:
  - Raw per-probe group means and SEs
  - GP posterior predictions (pred_A, pred_B) on the prediction grid
  - Posterior uncertainty (std_A, std_B)
  - Difference posterior (diff_mean, diff_std, ci_lower, ci_upper)
  - Annotation domains with their priors and learned kernel params
  - DMR calls

Outputs a single JSON to stdout. Can also generate a diagnostic PNG plot
if --plot is specified (writes to the path given).

Usage:
    # JSON only (pipe from stdin like gpdm_analysis.py):
    echo '{"h5file":..., "chr":..., ...}' | python gpdm_diagnostic.py

    # JSON + PNG plot:
    echo '{"h5file":..., "chr":..., ...}' | python gpdm_diagnostic.py --plot /tmp/diag.png
"""
import sys
import json
import logging
import numpy as np

logging.getLogger("gpdm").setLevel(logging.CRITICAL)

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

from gpdm import RegionalDMAnalysis
from gpdm_analysis import read_region_from_h5

# Annotation colors for the plot (mirrors client-side ANNOTATION_COLORS)
ANNOTATION_COLORS = {
    'CGI': '#06b6d4',
    'Shore': '#22d3ee',
    'Promoter': '#8b5cf6',
    'Enhancer': '#f59e0b',
    'CTCF': '#ef4444',
    'Intergenic': '#d1d5db',
}


class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            if np.isnan(obj) or np.isinf(obj):
                return None
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)


def run_diagnostic(params):
    h5file = params['h5file']
    chrom = params['chr']
    start = int(params['start'])
    stop = int(params['stop'])
    group1 = params['group1']
    group2 = params['group2']
    nan_threshold = float(params.get('nan_threshold', 0.5))
    annotations = params.get('annotations', [])
    priors_file = params.get('priors_file', None)

    all_samples = group1 + group2
    positions, beta_matrix, valid_samples = read_region_from_h5(
        h5file, all_samples, chrom, start, stop
    )
    if positions is None or len(positions) < 3:
        return {'error': f'Too few probes in {chrom}:{start}-{stop}'}

    group1_set = set(group1)
    groups = np.array(['group1' if s in group1_set else 'group2' for s in valid_samples])
    n_g1 = int(np.sum(groups == 'group1'))
    n_g2 = int(np.sum(groups == 'group2'))
    if n_g1 < 3 or n_g2 < 3:
        return {'error': f'Not enough samples (g1={n_g1}, g2={n_g2})'}

    # NaN filtering
    nan_frac = np.isnan(beta_matrix).mean(axis=0)
    keep = nan_frac <= nan_threshold
    positions = positions[keep]
    beta_matrix = beta_matrix[:, keep]
    if len(positions) < 3:
        return {'error': 'Too few probes after NaN filtering'}

    # Imputation
    if np.isnan(beta_matrix).any():
        keep2 = np.ones(beta_matrix.shape[1], dtype=bool)
        for grp in ('group1', 'group2'):
            mask = groups == grp
            all_nan = np.all(np.isnan(beta_matrix[mask, :]), axis=0)
            keep2 &= ~all_nan
        if not np.all(keep2):
            beta_matrix = beta_matrix[:, keep2]
            positions = positions[keep2]
        for grp in ('group1', 'group2'):
            mask = groups == grp
            grp_data = beta_matrix[mask, :]
            grp_means = np.nanmean(grp_data, axis=0)
            for j in range(grp_data.shape[1]):
                nans = np.isnan(grp_data[:, j])
                if np.any(nans):
                    grp_data[nans, j] = grp_means[j]
            beta_matrix[mask, :] = grp_data

    # Load priors
    dataset_priors = None
    if priors_file:
        try:
            with open(priors_file, 'r') as pf:
                dataset_priors = json.load(pf).get('priors', None)
        except (IOError, json.JSONDecodeError):
            pass

    # Run analysis
    analysis = RegionalDMAnalysis(chrom=chrom, start=start, end=stop,
                                   dataset_priors=dataset_priors)
    analysis.load_methylation(positions=positions.astype(float),
                               beta_values=beta_matrix, groups=groups,
                               group_A='group1', group_B='group2')
    for ann in annotations:
        analysis.add_annotation(ann['name'], int(ann['start']), int(ann['end']),
                                 base_methylation=ann.get('base_methylation'),
                                 length_scale_bp=ann.get('length_scale_bp'))
    analysis.run()

    r = analysis.results_annotation

    # Raw probe-level data
    mask_g1 = groups == 'group1'
    mask_g2 = groups == 'group2'
    raw_mean_g1 = beta_matrix[mask_g1].mean(axis=0)
    raw_mean_g2 = beta_matrix[mask_g2].mean(axis=0)
    raw_se_g1 = beta_matrix[mask_g1].std(axis=0) / np.sqrt(n_g1)
    raw_se_g2 = beta_matrix[mask_g2].std(axis=0) / np.sqrt(n_g2)

    # Annotation domain info
    domain_info = []
    for ann in analysis.annotations:
        ann_type = ann.name.split('_')[0] if '_' in ann.name else ann.name
        learned = r.learned_params.get(ann.name, {})
        domain_info.append({
            'name': ann.name,
            'type': ann_type,
            'start': int(ann.start),
            'end': int(ann.end),
            'prior_mean': float(ann.base_methylation),
            'prior_length_scale_bp': float(ann.length_scale_bp),
            'learned_length_scale_bp': learned.get('learned_ls_bp'),
        })

    # DMRs
    dmrs = []
    if r.dmrs:
        for d in r.dmrs:
            dmrs.append({
                'chr': chrom, 'start': int(d.start), 'stop': int(d.end),
                'width': int(d.width_bp),
                'max_delta_beta': float(d.max_delta_beta),
                'mean_delta_beta': float(d.mean_delta_beta),
                'direction': 'hyper' if d.mean_delta_beta >= 0 else 'hypo',
                'probability': float(d.mean_posterior_prob),
            })

    return {
        'status': 'ok',
        'region': f'{chrom}:{start}-{stop}',
        'n_probes': int(len(positions)),
        'n_g1': n_g1,
        'n_g2': n_g2,
        'probes': {
            'positions': positions.tolist(),
            'mean_group1': raw_mean_g1.tolist(),
            'mean_group2': raw_mean_g2.tolist(),
            'se_group1': raw_se_g1.tolist(),
            'se_group2': raw_se_g2.tolist(),
        },
        'gp_posterior': {
            'grid': r.grid_positions.tolist(),
            'pred_group1': r.pred_A.tolist(),
            'pred_group2': r.pred_B.tolist(),
            'std_group1': r.std_A.tolist(),
            'std_group2': r.std_B.tolist(),
            'diff_mean': r.diff_mean.tolist(),
            'diff_std': r.diff_std.tolist(),
            'ci_lower': r.ci_lower.tolist(),
            'ci_upper': r.ci_upper.tolist(),
        },
        'domains': domain_info,
        'dmrs': dmrs,
    }


def make_plot(diag, output_path):
    """Generate a 3-panel diagnostic PNG."""
    probes = diag['probes']
    gp = diag['gp_posterior']
    pos = np.array(probes['positions'])
    grid = np.array(gp['grid'])

    fig, axes = plt.subplots(3, 1, figsize=(16, 10), sharex=True,
                              gridspec_kw={'height_ratios': [3, 3, 2]})

    # --- Panel 1: Raw probes + GP posterior for each group ---
    ax1 = axes[0]
    ax1.set_title(f"GPDM Diagnostic — {diag['region']}  "
                  f"(n_probes={diag['n_probes']}, g1={diag['n_g1']}, g2={diag['n_g2']})",
                  fontsize=12, fontweight='bold')

    # Raw probe means with error bars
    ax1.errorbar(pos, probes['mean_group1'], yerr=np.array(probes['se_group1']),
                 fmt='o', ms=3, color='#5e81f4', alpha=0.5, label='Group1 probes', zorder=3)
    ax1.errorbar(pos, probes['mean_group2'], yerr=np.array(probes['se_group2']),
                 fmt='o', ms=3, color='#e66101', alpha=0.5, label='Group2 probes', zorder=3)

    # GP posterior
    pred_g1 = np.array(gp['pred_group1'])
    pred_g2 = np.array(gp['pred_group2'])
    std_g1 = np.array(gp['std_group1'])
    std_g2 = np.array(gp['std_group2'])
    ax1.plot(grid, pred_g1, '-', color='#3b5ee6', lw=1.5, label='GP Group1')
    ax1.fill_between(grid, pred_g1 - 1.96 * std_g1, pred_g1 + 1.96 * std_g1,
                     color='#5e81f4', alpha=0.15)
    ax1.plot(grid, pred_g2, '-', color='#c04e00', lw=1.5, label='GP Group2')
    ax1.fill_between(grid, pred_g2 - 1.96 * std_g2, pred_g2 + 1.96 * std_g2,
                     color='#e66101', alpha=0.15)
    ax1.set_ylabel('Beta value')
    ax1.set_ylim(-0.05, 1.05)
    ax1.legend(loc='upper right', fontsize=8)

    # Domain shading
    for d in diag['domains']:
        color = ANNOTATION_COLORS.get(d['type'], '#e5e7eb')
        ax1.axvspan(d['start'], d['end'], alpha=0.08, color=color)

    # --- Panel 2: Difference posterior ---
    ax2 = axes[1]
    diff = np.array(gp['diff_mean'])
    ci_lo = np.array(gp['ci_lower'])
    ci_hi = np.array(gp['ci_upper'])
    ax2.plot(grid, diff, '-', color='#333', lw=1.5, label='Δβ (G2 − G1)')
    ax2.fill_between(grid, ci_lo, ci_hi, color='#888', alpha=0.2, label='95% CI')
    ax2.axhline(0, color='#999', ls='--', lw=0.8)

    # Shade DMR regions
    for dmr in diag['dmrs']:
        color = '#e66101' if dmr['direction'] == 'hyper' else '#5e81f4'
        ax2.axvspan(dmr['start'], dmr['stop'], alpha=0.2, color=color)
        ax2.text((dmr['start'] + dmr['stop']) / 2, ax2.get_ylim()[1] * 0.9,
                 dmr['direction'], ha='center', fontsize=7, color=color, fontweight='bold')

    # Mark probe positions as ticks on x-axis
    for p in pos:
        ax2.axvline(p, color='#ccc', lw=0.3, alpha=0.5)

    ax2.set_ylabel('Δβ (Group2 − Group1)')
    ax2.legend(loc='upper right', fontsize=8)

    # Domain shading on panel 2
    for d in diag['domains']:
        color = ANNOTATION_COLORS.get(d['type'], '#e5e7eb')
        ax2.axvspan(d['start'], d['end'], alpha=0.08, color=color)

    # --- Panel 3: Domain annotations + probe density ---
    ax3 = axes[2]
    ax3.set_yticks([])

    # Draw domain rectangles
    for i, d in enumerate(diag['domains']):
        color = ANNOTATION_COLORS.get(d['type'], '#e5e7eb')
        rect = Rectangle((d['start'], 0.3), d['end'] - d['start'], 0.4,
                          fc=color, ec='#666', lw=0.5, alpha=0.7)
        ax3.add_patch(rect)
        # Label non-intergenic domains
        if d['type'] != 'Intergenic':
            mid = (d['start'] + d['end']) / 2
            label = d['type']
            if d.get('learned_length_scale_bp'):
                label += f"\nls={d['learned_length_scale_bp']:.0f}bp"
            ax3.text(mid, 0.5, label, ha='center', va='center', fontsize=6,
                     fontweight='bold')

    # Probe positions as vertical ticks
    for p in pos:
        ax3.plot([p, p], [0.0, 0.25], color='#333', lw=0.8)

    # Mark probe gaps > 1kb
    spacings = np.diff(pos)
    for i, sp in enumerate(spacings):
        if sp > 1000:
            mid = (pos[i] + pos[i + 1]) / 2
            ax3.annotate(f'{sp / 1000:.1f}kb gap', xy=(mid, 0.12),
                         ha='center', fontsize=6, color='red',
                         fontweight='bold')

    ax3.set_ylim(0, 1.0)
    ax3.set_xlim(grid[0], grid[-1])
    ax3.set_xlabel('Genomic position')
    ax3.set_ylabel('Domains & probes')

    # Legend for domain types
    from matplotlib.patches import Patch
    legend_patches = []
    seen = set()
    for d in diag['domains']:
        if d['type'] not in seen:
            seen.add(d['type'])
            color = ANNOTATION_COLORS.get(d['type'], '#e5e7eb')
            legend_patches.append(Patch(fc=color, ec='#666', label=d['type']))
    ax3.legend(handles=legend_patches, loc='upper right', fontsize=7, ncol=3)

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close()
    return output_path


if __name__ == '__main__':
    plot_path = None
    if '--plot' in sys.argv:
        idx = sys.argv.index('--plot')
        if idx + 1 < len(sys.argv):
            plot_path = sys.argv[idx + 1]

    try:
        input_data = sys.stdin.read()
        if not input_data.strip():
            print(json.dumps({'error': 'No input received on stdin'}))
            sys.exit(0)
        params = json.loads(input_data)
        result = run_diagnostic(params)

        if plot_path and 'error' not in result:
            make_plot(result, plot_path)
            result['plot_path'] = plot_path

        print(json.dumps(result, cls=NumpyEncoder))
    except Exception as e:
        import traceback
        print(json.dumps({'error': f'{str(e)}\n{traceback.format_exc()}'}))
