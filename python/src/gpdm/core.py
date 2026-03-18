"""
GPDM — Gaussian Process Differential Methylation.
Annotation-aware regional DMR analysis using domain-partitioned GPs with dataset-derived priors.
Public API: run_dmr(chrom, start, end, positions, beta_values, groups, annotations, dataset_priors)
"""
import numpy as np
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import Matern, WhiteKernel
from scipy.stats import norm
from dataclasses import dataclass, field
from typing import Optional, List, Dict
import warnings, logging

warnings.filterwarnings("ignore", category=UserWarning)
log = logging.getLogger("gpdm")


@dataclass
class Annotation:
    name: str
    start: int
    end: int
    color: str = "#94a3b8"
    base_methylation: float = 0.5
    length_scale_bp: float = 500.0
    ls_lower_bound_bp: Optional[float] = None
    ls_upper_bound_bp: Optional[float] = None
    short_label: str = ""
    def __post_init__(self):
        if not self.short_label:
            self.short_label = self.name[:5]


@dataclass
class DMR:
    chrom: str
    start: int
    end: int
    width_bp: int
    max_delta_beta: float
    mean_delta_beta: float
    mean_posterior_prob: float
    overlapping_annotations: List[str] = field(default_factory=list)
    def __repr__(self):
        return (f"DMR({self.chrom}:{self.start:,}-{self.end:,}, "
                f"w={self.width_bp}bp, Δβ={self.max_delta_beta:.3f}, P={self.mean_posterior_prob:.3f})")


@dataclass
class GPDMResults:
    grid_positions: np.ndarray
    pred_A: np.ndarray
    std_A: np.ndarray
    pred_B: np.ndarray
    std_B: np.ndarray
    diff_mean: np.ndarray
    diff_std: np.ndarray
    ci_lower: np.ndarray
    ci_upper: np.ndarray
    prob_positive: np.ndarray
    is_significant: np.ndarray
    dmrs: List[DMR]
    annotations: List[Annotation] = field(default_factory=list)
    group_A_name: str = ""
    group_B_name: str = ""
    learned_params: Dict = field(default_factory=dict)


# =============================================================================
# INTERNAL HELPERS
# =============================================================================

def make_intergenic(start, end, ig_priors):
    return Annotation(
        f"Intergenic_{start}", start, end, color="#94a3b8",
        base_methylation=ig_priors["base_methylation"],
        length_scale_bp=ig_priors["length_scale_bp"],
        ls_lower_bound_bp=ig_priors.get("ls_p10"),
        ls_upper_bound_bp=ig_priors.get("ls_p90"),
        short_label="Inter",
    )


def fill_gaps(annotations, region_start, region_end, ig_priors, max_intergenic_bp=50_000):
    if not annotations:
        return [make_intergenic(region_start, region_end, ig_priors)]
    annotations = sorted(annotations, key=lambda a: a.start)
    filled, pos = [], region_start
    for ann in annotations:
        if ann.start > pos + 10:
            gap = ann.start - pos
            n = max(1, int(np.ceil(gap / max_intergenic_bp)))
            seg = gap / n
            for i in range(n):
                s = int(pos + i * seg)
                e = int(pos + (i + 1) * seg) if i < n - 1 else ann.start
                filled.append(make_intergenic(s, e, ig_priors))
        filled.append(ann)
        pos = max(pos, ann.end)
    if pos < region_end - 10:
        gap = region_end - pos
        n = max(1, int(np.ceil(gap / max_intergenic_bp)))
        seg = gap / n
        for i in range(n):
            s = int(pos + i * seg)
            e = int(pos + (i + 1) * seg) if i < n - 1 else region_end
            filled.append(make_intergenic(s, e, ig_priors))
    return filled


def gp_posterior(filled_annotations, ig_priors, positions, mean_values, se_values,
                  grid_positions, margin_bp=150, max_length_scale_bp=5000):
    """Fit per-domain GPs then predict at grid_positions. Returns (y_mean, y_std, learned_params)."""
    domain_gps, domain_priors = {}, {}

    for ann in filled_annotations:
        lo, hi = ann.start - margin_bp, ann.end + margin_bp
        mask = (positions >= lo) & (positions < hi)
        if mask.sum() < 2:
            domain_gps[ann.name] = None
            domain_priors[ann.name] = ann.base_methylation
            continue
        X_dom, y_dom, se_dom = positions[mask], mean_values[mask], se_values[mask]
        domain_len = hi - lo
        X_norm = ((X_dom - lo) / domain_len).reshape(-1, 1)
        prior = float(np.mean(y_dom)) if ann.name.startswith("Intergenic_") else ann.base_methylation
        residuals = y_dom - prior
        ls_bp = np.clip(ann.length_scale_bp, 50, max_length_scale_bp)
        ls_frac = np.clip(ls_bp / domain_len, 0.02, 0.5)
        max_ls_frac = max_length_scale_bp / domain_len
        if ann.ls_lower_bound_bp is not None and ann.ls_upper_bound_bp is not None:
            ls_lower = min(max(ann.ls_lower_bound_bp / domain_len, 0.01), ls_frac * 0.9)
            ls_upper = max(min(ann.ls_upper_bound_bp / domain_len, max_ls_frac), ls_frac * 1.1)
        else:
            ls_lower = max(ls_frac * 0.3, 0.01)
            ls_upper = min(ls_frac * 5.0, max(max_ls_frac, ls_frac * 2.0))
        kernel = (1.0 * Matern(length_scale=ls_frac, nu=2.5,
                               length_scale_bounds=(ls_lower, ls_upper))
                  + WhiteKernel(noise_level=0.001, noise_level_bounds=(1e-6, 0.05)))
        gp = GaussianProcessRegressor(kernel=kernel, n_restarts_optimizer=5,
                                      alpha=se_dom**2 + 1e-5, normalize_y=False)
        gp.fit(X_norm, residuals)
        domain_gps[ann.name] = (gp, lo, hi, domain_len)
        domain_priors[ann.name] = prior

    n = len(grid_positions)
    w_mean, w_var, w_sum = np.zeros(n), np.zeros(n), np.zeros(n)
    for ann in filled_annotations:
        lo_m, hi_m = ann.start - margin_bp, ann.end + margin_bp
        mask = (grid_positions >= lo_m) & (grid_positions < hi_m)
        if not mask.any():
            continue
        gp_data = domain_gps.get(ann.name)
        prior = domain_priors.get(ann.name, ann.base_methylation)
        if gp_data is None:
            pred_mean = np.full(mask.sum(), prior)
            pred_std = np.full(mask.sum(), 0.15)
        else:
            gp, lo, hi, domain_len = gp_data
            X_q = ((grid_positions[mask] - lo) / domain_len).reshape(-1, 1)
            resid_mean, resid_std = gp.predict(X_q, return_std=True)
            pred_mean = resid_mean + prior
            pred_std = np.maximum(resid_std, 1e-4)
        # Distance-weighted blend in margin overlap zones
        w = np.ones(mask.sum())
        pts = grid_positions[mask]
        w[pts < ann.start] = np.maximum((pts[pts < ann.start] - lo_m) / margin_bp, 0.05)
        w[pts >= ann.end] = np.maximum((hi_m - pts[pts >= ann.end]) / margin_bp, 0.05)
        w_mean[mask] += w * pred_mean
        w_var[mask] += w * pred_std**2
        w_sum[mask] += w

    valid = w_sum > 0
    y_mean = np.full(n, ig_priors["base_methylation"])
    y_std = np.full(n, 0.15)
    y_mean[valid] = w_mean[valid] / w_sum[valid]
    y_std[valid] = np.sqrt(w_var[valid] / w_sum[valid])

    learned = {}
    for ann in filled_annotations:
        gp_data = domain_gps.get(ann.name)
        if gp_data:
            gp, lo, hi, domain_len = gp_data
            try:
                ls = gp.kernel_.k1.get_params().get("k2__length_scale")
                if ls:
                    learned[ann.name] = {"learned_ls_bp": ls * domain_len,
                                         "hint_ls_bp": ann.length_scale_bp,
                                         "prior_mean": ann.base_methylation}
            except Exception:
                pass

    return y_mean, y_std, learned


def split_at_probe_gaps(runs, grid, probe_positions, max_gap_bp):
    if probe_positions is None or len(probe_positions) < 2:
        return runs
    spacings = np.diff(probe_positions)
    large_gaps = [(probe_positions[i], probe_positions[i + 1])
                  for i in range(len(spacings)) if spacings[i] > max_gap_bp]
    if not large_gaps:
        return runs
    split_runs = []
    for rs, re in runs:
        lo, hi = grid[rs], grid[re]
        mids = sorted((g0 + g1) / 2 for g0, g1 in large_gaps if g0 < hi and g1 > lo)
        if not mids:
            split_runs.append((rs, re))
            continue
        cur = rs
        for mid in mids:
            idx = np.searchsorted(grid[cur:re + 1], mid) + cur - 1
            idx = max(cur, min(idx, re))
            if idx >= cur:
                split_runs.append((cur, idx))
            nxt = idx + 1
            while nxt <= re and grid[nxt] < mid + (mid - grid[idx]):
                nxt += 1
            cur = nxt
        if cur <= re:
            split_runs.append((cur, re))
    return split_runs


def call_dmrs(chrom, filled_annotations, grid, diff_mean, prob_pos, is_sig,
               min_width_bp, probe_positions, max_probe_gap_bp=2000):
    step = (grid[-1] - grid[0]) / (len(grid) - 1)
    runs, in_run, si = [], False, 0
    for i, sig in enumerate(is_sig):
        if sig and not in_run:
            si, in_run = i, True
        elif not sig and in_run:
            runs.append((si, i - 1))
            in_run = False
    if in_run:
        runs.append((si, len(is_sig) - 1))
    if not runs:
        return []
    # Merge runs separated by ≤1.5 grid steps
    merged = [runs[0]]
    for s, e in runs[1:]:
        if grid[s] - grid[merged[-1][1]] <= step * 1.5:
            merged[-1] = (merged[-1][0], e)
        else:
            merged.append((s, e))
    merged = split_at_probe_gaps(merged, grid, probe_positions, max_probe_gap_bp)
    dmrs = []
    for si, ei in merged:
        s, e = grid[si], grid[ei]
        if si == ei:
            s -= step / 2
            e += step / 2
        if e - s < min_width_bp:
            continue
        sl = slice(si, ei + 1)
        dm, pp = diff_mean[sl], prob_pos[sl]
        overlapping = [a.name for a in filled_annotations if a.end > s and a.start < e]
        dmrs.append(DMR(
            chrom=chrom, start=int(s), end=int(e), width_bp=int(e - s),
            max_delta_beta=float(np.max(np.abs(dm))),
            mean_delta_beta=float(np.mean(dm)),
            mean_posterior_prob=float(np.mean(pp)),
            overlapping_annotations=overlapping,
        ))
    return dmrs


# =============================================================================
# PUBLIC API
# =============================================================================

def run_dmr(chrom, start, end, positions, beta_values, groups, annotations, dataset_priors,
            group_A=None, group_B=None, credible_level=0.95, n_grid=500, min_dmr_width_bp=50):
    """
    Run annotation-aware GP differential methylation analysis.

    Parameters
    ----------
    chrom, start, end : genomic region
    positions : (n_cpgs,) CpG genomic coordinates
    beta_values : (n_samples, n_cpgs) beta matrix
    groups : (n_samples,) group labels
    annotations : list of {name, start, end} dicts from regulatory annotation query
    dataset_priors : dict from compute_methylation_priors.py
    group_A, group_B : group labels (default: alphabetical order)
    """
    if not dataset_priors:
        raise ValueError("dataset_priors required. Run compute_methylation_priors.py.")

    bm_priors = {k: v["base_methylation"] for k, v in dataset_priors.items() if "base_methylation" in v}
    ls_priors = {k: v["length_scale_bp"] for k, v in dataset_priors.items() if "length_scale_bp" in v}
    ls_bounds = {k: (v["ls_p10"], v["ls_p90"]) for k, v in dataset_priors.items()
                 if "ls_p10" in v and "ls_p90" in v}
    ig_priors = {"base_methylation": bm_priors.get("Intergenic", 0.65),
                 "length_scale_bp": ls_priors.get("Intergenic", 800)}
    if "Intergenic" in ls_bounds:
        ig_priors["ls_p10"], ig_priors["ls_p90"] = ls_bounds["Intergenic"]

    positions = np.asarray(positions, dtype=float)
    beta_values = np.asarray(beta_values, dtype=float)
    groups = np.asarray(groups)
    in_region = (positions >= start) & (positions <= end)
    if not in_region.any():
        raise ValueError(f"No CpGs in {chrom}:{start:,}-{end:,}. "
                         f"Data range: {positions.min():,.0f}-{positions.max():,.0f}")
    positions, beta_values = positions[in_region], beta_values[:, in_region]
    idx = np.argsort(positions)
    positions, beta_values = positions[idx], beta_values[:, idx]

    unique = sorted(set(groups))
    if len(unique) != 2:
        raise ValueError(f"Expected 2 groups, got {len(unique)}: {unique}")
    group_A = group_A or unique[0]
    group_B = group_B or [g for g in unique if g != group_A][0]
    mA, mB = groups == group_A, groups == group_B
    mean_A = beta_values[mA].mean(axis=0)
    mean_B = beta_values[mB].mean(axis=0)
    se_A = np.maximum(beta_values[mA].std(axis=0) / np.sqrt(mA.sum()), 1e-4)
    se_B = np.maximum(beta_values[mB].std(axis=0) / np.sqrt(mB.sum()), 1e-4)
    log.info(f"Loaded {len(positions)} CpGs | {group_A}: {mA.sum()} | {group_B}: {mB.sum()} samples")

    ann_objects = []
    for ann in annotations:
        name = ann['name']
        ann_type = next((k for k in bm_priors if k.lower() in name.lower()), None)
        if not ann_type:
            raise ValueError(f"No prior for '{name}'. Ensure priors file includes this annotation type.")
        bounds = ls_bounds.get(ann_type)
        ann_objects.append(Annotation(
            name=name, start=int(ann['start']), end=int(ann['end']),
            color=ann.get('color', '#94a3b8'),
            base_methylation=bm_priors[ann_type],
            length_scale_bp=ls_priors[ann_type],
            ls_lower_bound_bp=bounds[0] if bounds else None,
            ls_upper_bound_bp=bounds[1] if bounds else None,
            short_label=name[:6],
        ))

    filled = fill_gaps(ann_objects, start, end, ig_priors)
    grid = np.linspace(start, end, n_grid)

    pred_A, std_A, learned_params = gp_posterior(filled, ig_priors, positions, mean_A, se_A, grid)
    pred_B, std_B, _ = gp_posterior(filled, ig_priors, positions, mean_B, se_B, grid)

    diff_mean = pred_B - pred_A
    diff_std = np.sqrt(std_A**2 + std_B**2)
    z = norm.ppf((1 + credible_level) / 2)
    ci_lo, ci_hi = diff_mean - z * diff_std, diff_mean + z * diff_std
    is_sig = (ci_lo > 0) | (ci_hi < 0)
    prob_pos = 1 - norm.cdf(0, loc=diff_mean, scale=np.maximum(diff_std, 1e-8))

    dmrs = call_dmrs(chrom, filled, grid, diff_mean, prob_pos, is_sig, min_dmr_width_bp, positions)
    log.info(f"  {len(dmrs)} DMR(s) detected")
    for d in dmrs:
        log.info(f"    {d}")

    return GPDMResults(
        grid_positions=grid, pred_A=pred_A, std_A=std_A, pred_B=pred_B, std_B=std_B,
        diff_mean=diff_mean, diff_std=diff_std, ci_lower=ci_lo, ci_upper=ci_hi,
        prob_positive=prob_pos, is_significant=is_sig, dmrs=dmrs,
        annotations=filled, group_A_name=group_A, group_B_name=group_B,
        learned_params=learned_params,
    )
