"""
GPDM — Gaussian Process Differential Methylation
==================================================
Regional differential methylation analysis using annotation-aware
Gaussian Process models.

Implementation Overview
-----------------------
The core idea is to model the methylation landscape of each sample group as a
continuous function over genomic coordinates using a Gaussian Process (GP).
Rather than treating each CpG site independently (as classical statistical tests
do), a GP treats the region as a smooth function and explicitly models spatial
correlation between nearby probes.

Two GP strategies are offered:

  NaiveGP
    A single Matern(nu=2.5) kernel is fit to the entire region. This is
    statistically simple but can over-smooth across biologically distinct
    regulatory domains (e.g., a CGI embedded in a gene body).

  DomainPartitionedGP
    The region is partitioned into regulatory domains (CGI, Promoter, Enhancer,
    etc.). Each domain gets its own GP with:
      - A biologically-motivated prior mean (e.g., CGIs expected ~0.15)
      - A domain-specific length-scale prior (e.g., CGIs correlate over ~200bp)
      - 150bp overlap margins so adjacent domains blend smoothly at boundaries
    Predictions from overlapping domains are stitched via distance-weighted
    averaging, preventing discontinuities at domain boundaries.

Posterior Difference and DMR Calling
-------------------------------------
After fitting GPs to both groups (A = reference, B = comparison), the
difference function Delta(x) = pred_B(x) - pred_A(x) is computed at each
grid point. Because the GPs are independent:

    E[Delta(x)] = mu_B(x) - mu_A(x)
    Var[Delta(x)] = sigma_A(x)^2 + sigma_B(x)^2

A 95% credible interval is computed. Grid points where the CI excludes zero
are deemed "significant". Contiguous runs of significant points are merged
into DMR intervals, filtered by minimum width (50bp), and characterized by
max/mean delta-beta and mean posterior probability.

Usage:
    from gpdm import RegionalDMAnalysis

    analysis = RegionalDMAnalysis(
        chrom="chr8",
        start=127_735_000,
        end=127_745_000,
    )

    # Load your data
    analysis.load_methylation(
        positions=cpg_positions,       # array of genomic coordinates
        beta_values=beta_matrix,       # (n_samples, n_cpgs) array
        groups=group_labels,           # array: "tumor" or "normal" per sample
    )

    # Optionally add annotations
    analysis.add_annotations_from_bed("cpg_islands.bed", name="CGI")
    analysis.add_annotations_from_bed("ctcf_sites.bed", name="CTCF")

    # Or add them manually
    analysis.add_annotation("Enhancer", start=127_738_000, end=127_740_000,
                            base_methylation=0.45, length_scale_hint=600)

    # Run analysis
    results = analysis.run(method="annotation_aware")  # or "naive"

    # Visualize
    analysis.plot_results(save_path="results.png")

    # Export
    results_df = analysis.to_dataframe()
"""
# Imports 
# Standard scientific stack
import numpy as np
import pandas as pd

# sklearn GP: GaussianProcessRegressor wraps the kernel math and optimizer
from sklearn.gaussian_process import GaussianProcessRegressor
# Matern(nu=2.5): differentiable GP kernel appropriate for smooth biological signals
# WhiteKernel: models observation noise (heteroscedastic measurement error)
from sklearn.gaussian_process.kernels import Matern, WhiteKernel

# norm.cdf is used to convert the posterior mean/std of Delta into P(Delta > 0)
from scipy.stats import norm

# dataclass: lightweight struct for result containers
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Tuple, Union
import warnings
import logging

# Suppress sklearn convergence warnings — optimizer non-convergence is expected
# when very few CpGs fall in a domain; we handle these gracefully.
warnings.filterwarnings("ignore", category=UserWarning)

log = logging.getLogger("gpdm")


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class Annotation:
    """
    A regulatory domain annotation within the analysis region.

    Annotations serve two roles:
    1. Define GP domain boundaries for DomainPartitionedGP
    2. Carry biologically-informed priors (base_methylation, length_scale_bp)
       that constrain the GP kernel without the data alone having to learn them

    Attributes
    ----------
    name : str
        Human-readable label, e.g. "CGI_chr8_127736000"
    start, end : int
        Genomic coordinates (0-based, half-open like BED format)
    color : str
        Hex color for visualization
    base_methylation : float
        Prior mean beta value for this domain. The GP fits residuals relative
        to this value, so a well-calibrated prior reduces overfitting when
        a domain has few CpGs.
    length_scale_bp : float
        Expected spatial correlation range. Used to initialize and bound the
        Matern kernel's length-scale hyperparameter.
    short_label : str
        Up to 5-character label for annotation track visualization.
    """
    name: str
    start: int
    end: int
    color: str = "#94a3b8"
    base_methylation: float = 0.5
    length_scale_bp: float = 500.0
    short_label: str = ""

    def __post_init__(self):
        # Auto-generate short label from name if not provided
        if not self.short_label:
            self.short_label = self.name[:5]


@dataclass
class DMR:
    """
    A detected differentially methylated region.

    Produced by _call_dmrs() after GP inference. Represents a contiguous
    genomic interval where the 95% credible interval for Delta(x) = pred_B - pred_A
    excludes zero, filtered to width >= min_dmr_width_bp.

    Attributes
    ----------
    chrom : str
        Chromosome name
    start, end : int
        Genomic coordinates of the DMR interval
    width_bp : int
        end - start in base pairs
    max_delta_beta : float
        Largest absolute methylation difference within this DMR (max |Delta(x)|)
    mean_delta_beta : float
        Mean signed difference (positive = hypermethylated in group B)
    mean_posterior_prob : float
        Average P(Delta > 0) across the DMR grid points (proxy for confidence)
    overlapping_annotations : list of str
        Names of Annotation objects whose coordinates overlap this DMR
    """
    chrom: str
    start: int
    end: int
    width_bp: int
    max_delta_beta: float
    mean_delta_beta: float
    mean_posterior_prob: float
    overlapping_annotations: List[str] = field(default_factory=list)

    def __repr__(self):
        # Compact string for log output showing coordinates and key stats
        return (f"DMR({self.chrom}:{self.start:,}-{self.end:,}, "
                f"width={self.width_bp}bp, "
                f"max_Δβ={self.max_delta_beta:.4f}, "
                f"P(Δ>0)={self.mean_posterior_prob:.3f})")


@dataclass
class GPDMResults:
    """
    Container for all outputs from a single GP analysis run.

    All array attributes are aligned to the same grid_positions vector
    (500 points by default), enabling direct element-wise comparison and
    plotting without coordinate lookup.

    Attributes
    ----------
    method : str
        "naive" or "annotation_aware"
    grid_positions : ndarray, shape (n_grid,)
        Genomic coordinates of the prediction grid (linspace from start to end)
    pred_A, pred_B : ndarray, shape (n_grid,)
        Posterior mean beta values for groups A and B at each grid point
    std_A, std_B : ndarray, shape (n_grid,)
        Posterior standard deviation for each group (square root of GP variance)
    diff_mean : ndarray, shape (n_grid,)
        Pointwise posterior mean of Delta(x) = pred_B - pred_A
    diff_std : ndarray, shape (n_grid,)
        Pointwise posterior std of Delta(x) = sqrt(std_A^2 + std_B^2)
    ci_lower, ci_upper : ndarray, shape (n_grid,)
        95% credible interval bounds for Delta(x)
    prob_positive : ndarray, shape (n_grid,)
        P(Delta(x) > 0) at each grid point, computed from normal CDF
    is_significant : ndarray of bool, shape (n_grid,)
        True where CI excludes zero (i.e., ci_lower > 0 or ci_upper < 0)
    dmrs : list of DMR
        Detected differentially methylated regions
    group_A_name, group_B_name : str
        Labels for each group (used in column names and plot titles)
    learned_params : dict
        Kernel hyperparameters after optimization (for diagnostics)
    """
    method: str
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
    group_A_name: str = ""
    group_B_name: str = ""
    learned_params: Dict = field(default_factory=dict)


# =============================================================================
# DEFAULT ANNOTATION PRESETS
# =============================================================================

# Visualization colors per regulatory element type (used when adding annotations
# whose type is inferred from the name string)
ANNOTATION_COLORS = {
    "CGI": "#06b6d4",       # cyan — CpG islands typically hypomethylated
    "Shore": "#22d3ee",     # light cyan — CGI flanking shores
    "Shelf": "#67e8f9",     # lighter cyan — further from CGI
    "Promoter": "#8b5cf6",  # violet — active promoters often hypomethylated
    "Enhancer": "#f59e0b",  # amber — variable methylation
    "CTCF": "#ef4444",      # red — CTCF binding sites
    "Gene body": "#64748b", # gray — generally hypermethylated in expressed genes
    "Intergenic": "#94a3b8",# light gray — background genomic sequence
}

# Default Matern length-scale hints in base pairs.
# These initialize the GP kernel optimizer and set its search bounds.
# Smaller = finer-grained spatial correlation (e.g., narrow CGIs);
# larger = broader correlation (e.g., long gene bodies with plateau methylation).
DEFAULT_LENGTH_SCALES = {
    "CGI": 200,
    "Shore": 300,
    "Shelf": 400,
    "Promoter": 250,
    "Enhancer": 600,
    "CTCF": 150,
    "Gene body": 1000,
    "Intergenic": 800,
}

# Prior expected methylation level per regulatory element type.
# These become the GP mean function: the model fits residuals relative to
# this baseline, which regularizes predictions in sparsely-covered domains.
DEFAULT_BASE_METHYLATION = {
    "CGI": 0.15,        # CpG islands are characteristically hypomethylated
    "Shore": 0.40,      # shores transition from CGI to flanking sequence
    "Shelf": 0.60,      # shelves are typically moderately methylated
    "Promoter": 0.20,   # active promoters often hypomethylated
    "Enhancer": 0.45,   # enhancers are intermediate and context-dependent
    "CTCF": 0.55,       # CTCF sites often partially methylated
    "Gene body": 0.75,  # gene bodies of expressed genes are hypermethylated
    "Intergenic": 0.70, # default for non-annotated sequence
}


# =============================================================================
# CORE GP MODELS
# =============================================================================

class NaiveGP:
    """
    Single-kernel Gaussian Process fit across the entire analysis region.

    Uses a Matern(nu=2.5) covariance function, which corresponds to a
    twice-differentiable smooth process — appropriate for the gradual
    methylation transitions seen at most regulatory boundaries.

    A WhiteKernel additive noise term absorbs probe-level measurement error
    and biological variability not captured by the spatial structure.

    The region is normalized to [0, 1] before fitting so the length-scale
    hyperparameter is dimensionless and bounded consistently regardless of
    region size.

    Parameters
    ----------
    region_start, region_end : int
        Genomic coordinates defining the analysis window
    """

    def __init__(self, region_start, region_end):
        self.region_start = region_start
        self.region_end = region_end
        # Used for normalizing positions to [0, 1] (avoids numerical issues
        # with large genomic coordinate values in the kernel matrix)
        self.region_len = region_end - region_start
        self.gp = None  # set after fit()

    def fit(self, positions, mean_values, se_values):
        """
        Fit the GP to per-CpG group mean values.

        Parameters
        ----------
        positions : ndarray, shape (n_cpgs,)
            Genomic coordinates of observed CpG sites
        mean_values : ndarray, shape (n_cpgs,)
            Per-CpG mean beta value across samples in this group
        se_values : ndarray, shape (n_cpgs,)
            Per-CpG standard error; passed as alpha=se^2 so the GP
            treats each observation as having known heteroscedastic noise

        Returns
        -------
        self (for chaining)
        """
        # Normalize genomic positions to [0, 1] for numerical stability
        X = ((positions - self.region_start) / self.region_len).reshape(-1, 1)

        # Matern(nu=2.5) kernel: smooth but not infinitely differentiable.
        # Initial length-scale 0.08 = ~8% of region width. Bounds allow the
        # optimizer to find anything from very local (0.5%) to broad (50%) correlation.
        # The leading 1.0 * sets initial signal variance (also optimized).
        kernel = (
            1.0 * Matern(length_scale=0.08, nu=2.5,
                         length_scale_bounds=(0.005, 0.5))
            + WhiteKernel(noise_level=0.001,
                          noise_level_bounds=(1e-6, 0.05))
        )

        # alpha=se^2: adds the known observation variance to the diagonal of
        # the kernel matrix, equivalent to heteroscedastic noise. This is more
        # principled than treating all observations as equally uncertain.
        # n_restarts_optimizer=10: run L-BFGS-B from 10 random starting points
        # to avoid local optima in the marginal likelihood landscape.
        self.gp = GaussianProcessRegressor(
            kernel=kernel, n_restarts_optimizer=10,
            alpha=se_values**2, normalize_y=True,
        )
        self.gp.fit(X, mean_values)
        return self

    def predict(self, grid_positions):
        """
        Predict posterior mean and std at arbitrary grid positions.

        Parameters
        ----------
        grid_positions : ndarray, shape (n_grid,)
            Genomic coordinates to predict at

        Returns
        -------
        y_mean : ndarray, shape (n_grid,)
        y_std : ndarray, shape (n_grid,)  — floored at 1e-6 to avoid division by zero
        """
        # Normalize using the same scale as training
        X = ((grid_positions - self.region_start) / self.region_len).reshape(-1, 1)
        y_mean, y_std = self.gp.predict(X, return_std=True)
        # Floor std to prevent numerical issues in downstream CI computation
        return y_mean, np.maximum(y_std, 1e-6)

    def get_learned_params(self):
        """Extract learned kernel hyperparameters for diagnostics."""
        if self.gp is None:
            return {}
        try:
            # gp.kernel_ is the optimized kernel; k1 is the Matern part (1.0 * Matern)
            params = self.gp.kernel_.k1.get_params()
            # k2__length_scale is Matern's length-scale inside the Product kernel
            ls = params.get("k2__length_scale", None)
            # k1__constant_value is the signal variance amplitude
            sig = params.get("k1__constant_value", None)
            # k2 of the Sum kernel is the WhiteKernel
            noise = self.gp.kernel_.k2.get_params().get("noise_level", None)
            return {
                "length_scale_frac": ls,
                # Convert fraction back to bp for human-readable reporting
                "length_scale_bp": ls * self.region_len if ls else None,
                "signal_variance": sig,
                "noise_variance": noise,
            }
        except Exception:
            # Kernel structure might differ if bounds were hit; return empty
            return {}


class DomainPartitionedGP:
    """
    Annotation-aware GP that fits independent models per regulatory domain.

    Motivation: biological methylation patterns differ systematically between
    regulatory element types. A CGI has tight spatial correlation (~200bp) and
    low baseline methylation (~0.15), while an intergenic region has broad
    correlation (~800bp) and high baseline (~0.70). Fitting a single global GP
    forces a compromise that often under-fits one domain and over-smooths another.

    Strategy:
    1. Gap-fill the annotation set so every base pair is assigned to a domain.
    2. For each domain, expand by margin_bp (150bp) on both sides to capture
       probes near the boundary.
    3. Fit a GP to residuals (observed - domain prior mean) using a
       domain-specific kernel with biologically-informed length-scale bounds.
    4. At prediction time, use distance-weighted blending in overlap zones so
       the stitched prediction is continuous and smooth at domain boundaries.

    Parameters
    ----------
    region_start, region_end : int
        Analysis window coordinates
    annotations : list of Annotation
        Regulatory domain definitions (will be gap-filled by _fill_gaps)
    margin_bp : int
        Overlap margin for domain boundary blending (default 150bp)
    max_length_scale_bp : int
        Hard upper cap on optimized length-scale to prevent over-smoothing
        in large intergenic domains (default 5000bp)
    max_intergenic_bp : int
        Maximum intergenic segment size before subdividing into smaller
        segments (default 50kb). Prevents a single huge domain from learning
        a very long length-scale that washes out local signals.
    """

    def __init__(self, region_start, region_end, annotations: List[Annotation],
                 margin_bp=150, max_length_scale_bp=5000,
                 max_intergenic_bp=50_000):
        self.region_start = region_start
        self.region_end = region_end
        self.region_len = region_end - region_start
        self.annotations = annotations
        self.margin_bp = margin_bp
        # Precompute margin as a fraction of region for normalized coordinate math
        self.margin_frac = margin_bp / self.region_len
        self.max_length_scale_bp = max_length_scale_bp
        self.max_intergenic_bp = max_intergenic_bp
        # Maps domain name → (fitted GaussianProcessRegressor, lo, hi, domain_len)
        self.domain_gps = {}
        # Maps domain name → prior mean used when fitting this domain
        self.domain_priors = {}
        # Fill any unannotated gaps with Intergenic domains before fitting
        self._fill_gaps()

    def _fill_gaps(self):
        """
        Ensure the annotation list covers every base pair in the region.

        If no annotations were provided at all, the entire region becomes one
        Intergenic domain. Otherwise, gaps between annotations (and at the edges)
        are filled with Intergenic segments. Large gaps are subdivided into
        segments of at most max_intergenic_bp each to prevent a single domain
        from learning an excessively long correlation length.
        """
        if not self.annotations:
            # Trivial case: entire region is one intergenic domain
            self.annotations = [
                Annotation("Intergenic", self.region_start, self.region_end,
                           color="#94a3b8", base_methylation=0.65,
                           length_scale_bp=800)
            ]
            return

        # Sort annotations by genomic start position
        self.annotations.sort(key=lambda a: a.start)

        filled = []
        current_pos = self.region_start  # tracks how far we've covered

        for ann in self.annotations:
            if ann.start > current_pos + 10:
                # Gap larger than 10bp between current_pos and this annotation
                self._add_intergenic_segments(filled, current_pos, ann.start)
            filled.append(ann)
            # Advance current_pos to end of this annotation
            current_pos = max(current_pos, ann.end)

        # Fill any trailing gap after the last annotation
        if current_pos < self.region_end - 10:
            self._add_intergenic_segments(filled, current_pos, self.region_end)

        self.annotations = filled

    def _add_intergenic_segments(self, filled, start, end):
        """
        Add one or more Intergenic annotations to cover the gap [start, end).

        For gaps larger than max_intergenic_bp, the gap is divided into equal
        segments so no individual domain is wider than max_intergenic_bp.
        This prevents over-smoothing: a single 200kb domain would learn a very
        long length-scale and smooth over genuine within-domain DMRs.

        Parameters
        ----------
        filled : list
            The annotation list being built (modified in-place)
        start, end : int
            Genomic coordinates of the gap to fill
        """
        gap_size = end - start
        if gap_size <= self.max_intergenic_bp:
            # Small enough — add a single intergenic segment
            filled.append(Annotation(
                f"Intergenic_{start}",  # unique name avoids dict key collisions
                start, end,
                color="#94a3b8", base_methylation=0.65,
                length_scale_bp=800, short_label="Inter"
            ))
        else:
            # Subdivide into ceil(gap/max) equal segments
            n_segments = int(np.ceil(gap_size / self.max_intergenic_bp))
            seg_size = gap_size / n_segments
            for i in range(n_segments):
                seg_start = int(start + i * seg_size)
                # Last segment takes any rounding remainder
                seg_end = int(start + (i + 1) * seg_size) if i < n_segments - 1 else end
                filled.append(Annotation(
                    f"Intergenic_{seg_start}",
                    seg_start, seg_end,
                    color="#94a3b8", base_methylation=0.65,
                    length_scale_bp=800, short_label="Inter"
                ))

    def _get_annotation_at(self, genomic_pos):
        """Return the annotation covering genomic_pos (fallback: last annotation)."""
        for ann in self.annotations:
            if ann.start <= genomic_pos < ann.end:
                return ann
        return self.annotations[-1]

    def fit(self, positions, mean_values, se_values):
        """
        Fit a separate GP for each domain using the domain's extended window.

        For each annotation domain:
        - Expand window by margin_bp on each side to capture boundary probes
        - Subtract the domain's prior mean to get residuals
        - For auto-generated Intergenic domains, use observed data mean as prior
          (avoids shrinking real signals toward an arbitrary 0.65 baseline)
        - Fit GP to residuals with domain-specific kernel bounds
        - Store the fitted GP along with coordinate normalization info

        Parameters
        ----------
        positions : ndarray, shape (n_cpgs,)
            Genomic coordinates of observed CpG probes
        mean_values : ndarray, shape (n_cpgs,)
            Per-CpG group mean beta values
        se_values : ndarray, shape (n_cpgs,)
            Per-CpG standard errors

        Returns
        -------
        self
        """
        for ann in self.annotations:
            # Extended window includes margin_bp beyond each domain boundary
            lo = ann.start - self.margin_bp
            hi = ann.end + self.margin_bp

            # Select CpG probes that fall within the extended window
            mask = (positions >= lo) & (positions < hi)

            if mask.sum() < 2:
                # Insufficient probes to fit a GP: store None and fall back to
                # the prior mean ± broad uncertainty during prediction
                self.domain_gps[ann.name] = None
                self.domain_priors[ann.name] = ann.base_methylation
                continue

            # Extract domain's observed data
            X_dom = positions[mask]
            y_dom = mean_values[mask]
            se_dom = se_values[mask]

            # Normalize positions to [0, 1] within the extended domain window
            # (not the full region) so the length-scale is relative to domain size
            domain_len = hi - lo
            X_norm = ((X_dom - lo) / domain_len).reshape(-1, 1)

            # Compute prior mean to subtract:
            # - Named annotations (CGI, Promoter, etc.) use their canonical prior
            # - Auto-generated Intergenic segments use the local observed mean
            #   because there is no biological basis for a fixed prior here
            if ann.name.startswith("Intergenic_"):
                prior = float(np.mean(y_dom))
            else:
                prior = ann.base_methylation
            residuals = y_dom - prior  # GP fits zero-mean residuals

            # Compute initial length-scale as a fraction of domain size,
            # then clip to [0.02, 0.5] to prevent degenerate kernels
            ls_frac = ann.length_scale_bp / domain_len
            ls_frac = np.clip(ls_frac, 0.02, 0.5)

            # Cap the optimizer's upper search bound to prevent fitting a
            # length-scale longer than max_length_scale_bp (5kb default).
            # Without this cap, a 100kb domain could learn ls > 50kb and
            # produce a nearly flat prediction that masks local DMRs.
            max_ls_frac = self.max_length_scale_bp / domain_len
            ls_upper = min(ls_frac * 8, max(max_ls_frac, ls_frac * 1.5))

            # Domain-specific Matern kernel with bounded length-scale
            kernel = (
                1.0 * Matern(
                    length_scale=ls_frac, nu=2.5,
                    length_scale_bounds=(ls_frac * 0.2, ls_upper),
                )
                + WhiteKernel(noise_level=0.001,
                              noise_level_bounds=(1e-6, 0.05))
            )

            # Fewer restarts than NaiveGP (5 vs 10) because each domain's
            # marginal likelihood surface is simpler (fewer data points).
            # The 1e-5 in alpha adds a small jitter for numerical stability.
            gp = GaussianProcessRegressor(
                kernel=kernel, n_restarts_optimizer=5,
                alpha=se_dom**2 + 1e-5, normalize_y=False,
            )
            gp.fit(X_norm, residuals)

            # Store everything needed to predict: GP, domain window, and domain length
            self.domain_gps[ann.name] = (gp, lo, hi, domain_len)
            self.domain_priors[ann.name] = prior

        return self

    def predict(self, grid_positions):
        """
        Predict posterior mean and std at grid positions by stitching domains.

        For each domain, predictions are made at grid points within the extended
        window (domain ± margin_bp). Points inside the domain core get full
        weight 1.0; points in the margin overlap zone get linearly tapered weight
        based on distance from the domain boundary.

        The final prediction at each grid point is the weighted average of all
        domains that contributed to it. This blending ensures:
        1. No hard discontinuities at domain boundaries
        2. Core-domain predictions are not diluted by the neighboring domain's fit
        3. Variance is propagated consistently (weighted average of variances)

        Parameters
        ----------
        grid_positions : ndarray, shape (n_grid,)
            Genomic coordinates to predict at

        Returns
        -------
        y_mean : ndarray, shape (n_grid,)
        y_std : ndarray, shape (n_grid,)
        """
        n = len(grid_positions)
        # Accumulators for weighted average
        weighted_mean = np.zeros(n)
        weighted_var = np.zeros(n)
        weight_sum = np.zeros(n)

        for ann in self.annotations:
            # Predict at all grid points in the extended window
            lo_mask = ann.start - self.margin_bp
            hi_mask = ann.end + self.margin_bp
            mask = (grid_positions >= lo_mask) & (grid_positions < hi_mask)
            if not mask.any():
                continue

            gp_data = self.domain_gps.get(ann.name)
            prior = self.domain_priors.get(ann.name, 0.5)

            if gp_data is None:
                # Domain had < 2 probes: return prior mean with broad uncertainty
                pred_mean = np.full(mask.sum(), prior)
                pred_std = np.full(mask.sum(), 0.15)
            else:
                gp, lo, hi, domain_len = gp_data
                # Normalize query positions relative to this domain's window
                X_q = ((grid_positions[mask] - lo) / domain_len).reshape(-1, 1)
                # GP predicts residuals; add back the domain prior mean
                resid_mean, resid_std = gp.predict(X_q, return_std=True)
                pred_mean = resid_mean + prior
                # Floor std to avoid zero-variance collapse
                pred_std = np.maximum(resid_std, 1e-4)

            # Compute per-point blending weights:
            # - Inside domain core: weight = 1.0
            # - In left margin: weight tapers linearly from 0.05 to 1.0
            # - In right margin: weight tapers linearly from 1.0 to 0.05
            weights = np.ones(mask.sum())
            for k, pos in enumerate(grid_positions[mask]):
                if pos < ann.start:
                    # Left margin: closer to lo_mask → lower weight
                    weights[k] = max((pos - lo_mask) / self.margin_bp, 0.05)
                elif pos >= ann.end:
                    # Right margin: closer to hi_mask → lower weight
                    weights[k] = max((hi_mask - pos) / self.margin_bp, 0.05)
                # else: core domain, weight stays 1.0

            # Accumulate weighted contributions
            weighted_mean[mask] += weights * pred_mean
            weighted_var[mask] += weights * pred_std**2  # weighted sum of variances
            weight_sum[mask] += weights

        # Normalize accumulators; default to prior values for uncovered points
        valid = weight_sum > 0
        y_mean = np.full(n, 0.5)   # fallback mean
        y_std = np.full(n, 0.2)    # fallback std (broad uncertainty)
        y_mean[valid] = weighted_mean[valid] / weight_sum[valid]
        # Average variance, then take sqrt to get std
        y_std[valid] = np.sqrt(weighted_var[valid] / weight_sum[valid])

        return y_mean, y_std

    def get_learned_params(self):
        """
        Extract learned kernel hyperparameters from each domain's fitted GP.

        Returns a dict mapping domain name to:
          - learned_ls_bp: optimized length-scale in base pairs
          - hint_ls_bp: the biological prior length-scale that was used to
            initialize and bound the optimizer
          - prior_mean: the prior mean subtracted before fitting
        """
        params = {}
        for ann in self.annotations:
            gp_data = self.domain_gps.get(ann.name)
            if gp_data is not None:
                gp, lo, hi, domain_len = gp_data
                try:
                    # k1 of the fitted Sum kernel is the Product(1.0 * Matern)
                    k_params = gp.kernel_.k1.get_params()
                    ls = k_params.get("k2__length_scale", None)
                    if ls is not None:
                        params[ann.name] = {
                            # Convert fraction back to bp
                            "learned_ls_bp": ls * domain_len,
                            "hint_ls_bp": ann.length_scale_bp,
                            "prior_mean": ann.base_methylation,
                        }
                except Exception:
                    pass  # kernel structure can vary if bounds were hit
        return params


# =============================================================================
# MAIN ANALYSIS CLASS
# =============================================================================

class RegionalDMAnalysis:
    """
    Main interface for GP-based regional differential methylation analysis.

    Orchestrates the full pipeline:
      load_methylation → add_annotation(s) → run → to_dataframe / plot_results

    The class holds all state: raw data, preprocessed summaries, annotations,
    and both naive and annotation-aware results (when method="both").

    Parameters
    ----------
    chrom : str
        Chromosome name (e.g., "chr8")
    start : int
        Region start coordinate
    end : int
        Region end coordinate
    """

    def __init__(self, chrom: str, start: int, end: int):
        self.chrom = chrom
        self.start = start
        self.end = end
        self.region_len = end - start

        # --- Raw data (set by load_methylation) ---
        self.positions = None       # (n_cpgs,) genomic coords, sorted
        self.beta_values = None     # (n_samples, n_cpgs) beta matrix
        self.groups = None          # (n_samples,) group labels
        self.group_names = None     # (group_A_label, group_B_label)
        self.n_cpgs = 0             # number of CpGs after region filtering

        # --- Per-group summaries (derived from raw data) ---
        self.mean_A = None          # (n_cpgs,) mean beta for group A
        self.mean_B = None          # (n_cpgs,) mean beta for group B
        self.se_A = None            # (n_cpgs,) std error for group A
        self.se_B = None            # (n_cpgs,) std error for group B

        # --- Annotations ---
        self.annotations: List[Annotation] = []  # added before run()

        # --- Results (set after run()) ---
        self.results: Optional[GPDMResults] = None                # primary results
        self.results_naive: Optional[GPDMResults] = None          # naive GP results
        self.results_annotation: Optional[GPDMResults] = None     # annotation-aware results

    # -----------------------------------------------------------------
    # DATA LOADING
    # -----------------------------------------------------------------

    def load_methylation(
        self,
        positions: np.ndarray,
        beta_values: np.ndarray,
        groups: np.ndarray,
        group_A: Optional[str] = None,
        group_B: Optional[str] = None,
    ):
        """
        Load methylation data and compute per-group summary statistics.

        The loaded data is immediately filtered to the analysis region and
        sorted by position. Per-group mean and SE are computed and stored;
        the raw individual-sample beta values are also retained for visualization.

        Parameters
        ----------
        positions : array of shape (n_cpgs,)
            Genomic coordinates of CpG sites.
        beta_values : array of shape (n_samples, n_cpgs)
            Beta values (0-1 methylation proportion).
        groups : array of shape (n_samples,)
            Group label for each sample (e.g., "tumor", "normal").
        group_A : str, optional
            Name of reference group. If None, uses alphabetically first.
        group_B : str, optional
            Name of comparison group. If None, uses the other group.
        """
        # Coerce inputs to numpy arrays with appropriate dtypes
        positions = np.asarray(positions, dtype=float)
        beta_values = np.asarray(beta_values, dtype=float)
        groups = np.asarray(groups)

        # Filter CpGs to the analysis region [start, end]
        in_region = (positions >= self.start) & (positions <= self.end)
        if not in_region.any():
            raise ValueError(
                f"No CpGs found in {self.chrom}:{self.start:,}-{self.end:,}. "
                f"Position range in data: {positions.min():,.0f}-{positions.max():,.0f}"
            )

        # Apply region filter
        positions = positions[in_region]
        beta_values = beta_values[:, in_region]  # select columns (CpG axis)

        # Sort by genomic position (required for sequential DMR calling logic)
        sort_idx = np.argsort(positions)
        self.positions = positions[sort_idx]
        self.beta_values = beta_values[:, sort_idx]
        self.groups = groups
        self.n_cpgs = len(self.positions)

        # Validate exactly 2 groups
        unique_groups = sorted(set(groups))
        if len(unique_groups) != 2:
            raise ValueError(
                f"Expected exactly 2 groups, got {len(unique_groups)}: {unique_groups}"
            )

        # Default group assignment: alphabetical order (A = first, B = second)
        if group_A is None:
            group_A = unique_groups[0]
        if group_B is None:
            group_B = [g for g in unique_groups if g != group_A][0]

        self.group_names = (group_A, group_B)
        mask_A = groups == group_A
        mask_B = groups == group_B

        n_A = mask_A.sum()
        n_B = mask_B.sum()

        # Compute per-CpG mean and SE for each group
        self.mean_A = self.beta_values[mask_A].mean(axis=0)
        self.mean_B = self.beta_values[mask_B].mean(axis=0)
        # SE = std / sqrt(n): standard error of the mean
        self.se_A = self.beta_values[mask_A].std(axis=0) / np.sqrt(n_A)
        self.se_B = self.beta_values[mask_B].std(axis=0) / np.sqrt(n_B)

        # Floor SE at 1e-4 to prevent near-zero alpha in the GP kernel matrix
        # (very small values can make the kernel matrix nearly singular)
        self.se_A = np.maximum(self.se_A, 1e-4)
        self.se_B = np.maximum(self.se_B, 1e-4)

        log.info(f"Loaded {self.n_cpgs} CpGs in {self.chrom}:{self.start:,}-{self.end:,}")
        log.info(f"  Group A ({group_A}): {n_A} samples")
        log.info(f"  Group B ({group_B}): {n_B} samples")
        log.info(f"  CpG spacing: {np.min(np.diff(self.positions)):.0f}-"
                 f"{np.max(np.diff(self.positions)):.0f} bp")

    def load_methylation_df(
        self,
        df: pd.DataFrame,
        position_col: str = "position",
        sample_cols: Optional[List[str]] = None,
        group_map: Optional[Dict[str, str]] = None,
    ):
        """
        Convenience wrapper to load methylation from a DataFrame.

        Extracts positions and beta values from a tidy DataFrame and calls
        load_methylation() with the restructured arrays.

        Parameters
        ----------
        df : DataFrame
            Must have a position column and one column per sample with beta values.
        position_col : str
            Name of the column containing genomic positions.
        sample_cols : list of str, optional
            Sample column names. If None, all columns except position_col.
        group_map : dict
            Maps sample column names to group labels.
            E.g., {"sample1": "tumor", "sample2": "tumor", "sample3": "normal", ...}
        """
        if sample_cols is None:
            # All non-position columns are assumed to be sample beta values
            sample_cols = [c for c in df.columns if c != position_col]

        if group_map is None:
            raise ValueError("group_map is required: dict mapping sample names to group labels")

        positions = df[position_col].values
        beta_values = df[sample_cols].values.T  # transpose: (n_samples, n_cpgs)
        groups = np.array([group_map[s] for s in sample_cols])

        self.load_methylation(positions, beta_values, groups)

    # -----------------------------------------------------------------
    # ANNOTATIONS
    # -----------------------------------------------------------------

    def add_annotation(
        self,
        name: str,
        start: int,
        end: int,
        base_methylation: Optional[float] = None,
        length_scale_bp: Optional[float] = None,
        color: Optional[str] = None,
        short_label: Optional[str] = None,
    ):
        """
        Manually add a regulatory domain annotation.

        Biologically-informed defaults are inferred from the annotation name
        if the name contains a known regulatory element keyword (e.g., "CGI",
        "Promoter", "Enhancer"). If methylation data has already been loaded,
        the base_methylation defaults to the local observed mean rather than
        a global canonical value, which is more accurate for the specific dataset.

        Parameters
        ----------
        name : str
            Annotation label (e.g., "CGI_chr8_127736000", "Promoter_MYC")
        start, end : int
            Genomic coordinates of the annotation
        base_methylation : float, optional
            Prior mean beta value. If None, inferred from name or local data.
        length_scale_bp : float, optional
            Expected correlation range. If None, inferred from name.
        color : str, optional
            Hex color for visualization. If None, inferred from name.
        short_label : str, optional
            Short label for annotation track (max ~6 chars).
        """
        # Case-insensitive substring match against known annotation type keys
        name_lower = name.lower()
        ann_type = None
        for key in DEFAULT_BASE_METHYLATION:
            if key.lower() in name_lower:
                ann_type = key
                break

        if base_methylation is None:
            if ann_type and self.mean_A is not None:
                # Use local observed mean from loaded data as a data-driven prior
                mask = (self.positions >= start) & (self.positions < end)
                if mask.sum() >= 2:
                    # Average of group means gives overall expected level
                    base_methylation = float(np.mean(
                        np.concatenate([self.mean_A[mask], self.mean_B[mask]])
                    ))
                else:
                    # Fall back to canonical prior if too few probes in domain
                    base_methylation = DEFAULT_BASE_METHYLATION.get(ann_type, 0.5)
            else:
                # Use canonical biological prior
                base_methylation = DEFAULT_BASE_METHYLATION.get(ann_type, 0.5)

        if length_scale_bp is None:
            length_scale_bp = DEFAULT_LENGTH_SCALES.get(ann_type, 500)

        if color is None:
            color = ANNOTATION_COLORS.get(ann_type, "#94a3b8")

        ann = Annotation(
            name=name, start=start, end=end,
            color=color, base_methylation=base_methylation,
            length_scale_bp=length_scale_bp,
            short_label=short_label or name[:6],
        )
        self.annotations.append(ann)
        log.info(f"  Added annotation: {name} ({start:,}-{end:,}), "
                 f"prior_β={base_methylation:.2f}, ls={length_scale_bp:.0f}bp")

    def add_annotations_from_bed(
        self,
        bed_path: str,
        name: str = "Region",
        base_methylation: Optional[float] = None,
        length_scale_bp: Optional[float] = None,
        color: Optional[str] = None,
    ):
        """
        Load regulatory annotations from a BED file.

        Only annotations that overlap the analysis region are imported.
        Coordinates are clipped to the region boundaries so no domain
        extends outside the analysis window.

        Parameters
        ----------
        bed_path : str
            Path to a BED file (tab-separated: chrom, start, end, [name, score, strand, ...])
        name : str
            Fallback annotation type name (used to infer priors if BED has no name column)
        base_methylation, length_scale_bp, color : optional
            Override defaults for all annotations from this file

        BED format: chrom  start  end  [name]  [score]  [strand]
        """
        import csv

        with open(bed_path, 'r') as f:
            reader = csv.reader(f, delimiter='\t')
            count = 0
            for row in reader:
                # Skip header and track lines
                if row[0].startswith('#') or row[0].startswith('track'):
                    continue
                chrom = row[0]
                s = int(row[1])
                e = int(row[2])
                # Use BED name column if present, otherwise auto-generate
                ann_name = row[3] if len(row) > 3 else f"{name}_{count}"

                # Only import annotations on the same chromosome
                if chrom != self.chrom:
                    continue
                # Only import if the annotation overlaps the analysis region
                if e < self.start or s > self.end:
                    continue

                # Clip annotation to the analysis region boundaries
                s = max(s, self.start)
                e = min(e, self.end)

                self.add_annotation(
                    name=ann_name, start=s, end=e,
                    base_methylation=base_methylation,
                    length_scale_bp=length_scale_bp,
                    color=color,
                )
                count += 1

        log.info(f"Loaded {count} annotations from {bed_path}")

    def infer_annotations_from_data(self):
        """
        Heuristic fallback: infer domain structure from CpG density.

        Identifies clusters of densely-spaced CpGs (spacing < 50% of median)
        as likely CpG islands or promoters. This is a rough approximation used
        when no external annotation file is available.

        Clusters of ≥3 consecutive dense probes are added as "Dense_cluster_N"
        annotations with a 200bp length-scale (short-range correlation, like a CGI).
        """
        if self.positions is None:
            raise ValueError("Load methylation data first")

        # Inter-probe spacings
        spacings = np.diff(self.positions)
        median_spacing = np.median(spacings)

        # Dense = spacing below 50% of median
        dense_threshold = median_spacing * 0.5
        in_dense = spacings < dense_threshold

        # Find contiguous runs of dense probes
        regions = []
        in_region = False
        start_idx = 0

        for i, dense in enumerate(in_dense):
            if dense and not in_region:
                start_idx = i
                in_region = True
            elif not dense and in_region:
                # Require at least 3 consecutive dense CpGs to call a cluster
                if i - start_idx >= 3:
                    regions.append((start_idx, i))
                in_region = False
        # Handle run that extends to the end of the array
        if in_region and len(in_dense) - start_idx >= 3:
            regions.append((start_idx, len(in_dense)))

        # Add each cluster as an annotation
        for j, (si, ei) in enumerate(regions):
            s = int(self.positions[si])
            # Clamp end index to valid range
            e = int(self.positions[min(ei, len(self.positions)-1)])
            self.add_annotation(
                f"Dense_cluster_{j+1}", s, e,
                base_methylation=None,      # will be inferred from data
                length_scale_bp=200,        # short-range, CGI-like
                color="#06b6d4",
                short_label=f"Dense{j+1}",
            )

        log.info(f"Inferred {len(regions)} dense CpG clusters as annotations")

    # -----------------------------------------------------------------
    # ANALYSIS
    # -----------------------------------------------------------------

    def run(
        self,
        method: str = "both",
        credible_level: float = 0.95,
        n_grid: int = 500,
        min_dmr_width_bp: int = 50,
    ) -> GPDMResults:
        """
        Run the full differential methylation analysis pipeline.

        Dispatches to _fit_and_analyze() for the requested method(s).
        If method="both", runs naive first, then annotation-aware. The
        annotation-aware result is returned as the primary result in that case.

        Parameters
        ----------
        method : str
            "naive" — single GP across region (fast, less accurate)
            "annotation_aware" — domain-partitioned GP (default, more accurate)
            "both" — run both and store separately; annotation-aware is primary
        credible_level : float
            Credible interval level (default 0.95 → z ≈ 1.96)
        n_grid : int
            Number of evenly-spaced prediction points across the region (default 500)
        min_dmr_width_bp : int
            Minimum DMR width to report; filters out single-point artifacts (default 50bp)

        Returns
        -------
        GPDMResults with the primary method's results
        """
        if self.positions is None:
            raise ValueError("Load methylation data first with load_methylation()")

        # Evenly-spaced prediction grid from region start to end
        grid_positions = np.linspace(self.start, self.end, n_grid)

        if method in ("naive", "both"):
            log.info("\n--- Fitting Naive GP ---")
            self.results_naive = self._fit_and_analyze(
                "naive", grid_positions, credible_level, min_dmr_width_bp
            )

        if method in ("annotation_aware", "both"):
            # If no annotations were added manually, try to infer from data density
            if not self.annotations:
                log.info("No annotations provided — inferring from CpG density...")
                self.infer_annotations_from_data()

            log.info("\n--- Fitting Annotation-Aware GP ---")
            self.results_annotation = self._fit_and_analyze(
                "annotation_aware", grid_positions, credible_level, min_dmr_width_bp
            )

        # Set primary results pointer
        if method == "naive":
            self.results = self.results_naive
        elif method == "annotation_aware":
            self.results = self.results_annotation
        else:
            # Both: annotation-aware is the preferred primary result
            self.results = self.results_annotation

        return self.results

    def _fit_and_analyze(self, method, grid_positions, credible_level, min_dmr_width_bp):
        """
        Core analysis: fit GP models for both groups, compute posterior difference,
        and call DMRs from the resulting credible intervals.

        Steps:
        1. Instantiate the appropriate model class (NaiveGP or DomainPartitionedGP)
        2. Fit separate models for group A and group B
        3. Predict at each grid point to get posterior mean and std for each group
        4. Compute Delta(x) = pred_B - pred_A and propagate uncertainty
        5. Compute credible interval and per-point posterior probability
        6. Call DMRs from significant (CI excludes zero) grid point runs

        Parameters
        ----------
        method : str
            "naive" or "annotation_aware"
        grid_positions : ndarray
            Grid of genomic positions for posterior prediction
        credible_level : float
            CI level (e.g., 0.95)
        min_dmr_width_bp : int
            Minimum width to retain a DMR

        Returns
        -------
        GPDMResults
        """
        if method == "naive":
            # Shared NaiveGP structure but fit independently for each group
            model_A = NaiveGP(self.start, self.end)
            model_B = NaiveGP(self.start, self.end)
        else:
            # Deep copy of annotations: each group needs its own DomainPartitionedGP
            # instance so they don't share state during gap-filling or fitting
            model_A = DomainPartitionedGP(
                self.start, self.end, self.annotations
            )
            model_B = DomainPartitionedGP(
                self.start, self.end,
                # Reconstruct annotation objects to avoid shared mutable state
                [Annotation(a.name, a.start, a.end, a.color,
                           a.base_methylation, a.length_scale_bp,
                           a.short_label) for a in self.annotations]
            )

        # Fit each group's GP to its own observed mean + SE
        log.info(f"  Fitting {self.group_names[0]}...")
        model_A.fit(self.positions, self.mean_A, self.se_A)
        log.info(f"  Fitting {self.group_names[1]}...")
        model_B.fit(self.positions, self.mean_B, self.se_B)

        # Predict posterior mean and std at all grid points
        pred_A, std_A = model_A.predict(grid_positions)
        pred_B, std_B = model_B.predict(grid_positions)

        # Posterior difference: independent GPs so variances add
        # E[B - A] = E[B] - E[A]
        diff_mean = pred_B - pred_A
        # Var[B - A] = Var[A] + Var[B] (independence assumption)
        diff_std = np.sqrt(std_A**2 + std_B**2)

        # Credible interval: z-score from the normal quantile function
        # e.g., credible_level=0.95 → z=1.96
        z = norm.ppf((1 + credible_level) / 2)
        ci_lo = diff_mean - z * diff_std
        ci_hi = diff_mean + z * diff_std

        # Significance: CI excludes zero means the direction of Delta is certain
        is_sig = (ci_lo > 0) | (ci_hi < 0)

        # Posterior probability that group B is greater than group A at each point
        # P(Delta > 0) = 1 - Phi(0 | mu=diff_mean, sigma=diff_std)
        # Floor diff_std to prevent division by near-zero in norm.cdf
        prob_pos = 1 - norm.cdf(0, loc=diff_mean,
                                 scale=np.maximum(diff_std, 1e-8))

        # Convert significant grid points to DMR intervals
        dmrs = self._call_dmrs(grid_positions, diff_mean, prob_pos,
                               is_sig, min_dmr_width_bp)

        # Collect learned kernel parameters for diagnostics / logging
        params = model_A.get_learned_params()
        log.info(f"  Detected {len(dmrs)} DMR(s):")
        for dmr in dmrs:
            log.info(f"    {dmr}")

        # Log the learned length-scale for the naive model (single value)
        if isinstance(model_A, NaiveGP):
            ls = params.get("length_scale_bp")
            if ls:
                log.info(f"  Learned length-scale: {ls:.0f} bp")

        # Log per-domain length-scales for the annotation-aware model
        if isinstance(model_A, DomainPartitionedGP):
            log.info(f"  Per-domain length-scales:")
            for name, p in params.items():
                ls = p.get("learned_ls_bp")
                if ls:
                    log.info(f"    {name:20s}: {ls:.0f} bp")

        return GPDMResults(
            method=method,
            grid_positions=grid_positions,
            pred_A=pred_A, std_A=std_A,
            pred_B=pred_B, std_B=std_B,
            diff_mean=diff_mean, diff_std=diff_std,
            ci_lower=ci_lo, ci_upper=ci_hi,
            prob_positive=prob_pos,
            is_significant=is_sig,
            dmrs=dmrs,
            group_A_name=self.group_names[0],
            group_B_name=self.group_names[1],
            learned_params=params,
        )

    def _call_dmrs(self, grid_positions, diff_mean, prob_pos,
                   is_sig, min_width_bp):
        """
        Convert per-grid-point significance flags into DMR intervals.

        Algorithm:
        1. Collect contiguous runs of significant grid points
        2. Merge runs separated by ≤1.5 grid steps (one non-significant point)
           to avoid fragmenting a DMR that briefly dips below the significance
           threshold due to a local probe gap
        3. Expand single-point DMRs to ±half grid step (each point represents
           a continuous neighborhood, not a single base pair)
        4. Filter out intervals narrower than min_width_bp

        Parameters
        ----------
        grid_positions : ndarray
            Genomic positions of the prediction grid
        diff_mean : ndarray
            Posterior mean of Delta at each grid point
        prob_pos : ndarray
            P(Delta > 0) at each grid point
        is_sig : ndarray of bool
            Significance flag at each grid point
        min_width_bp : int
            Minimum DMR width to report

        Returns
        -------
        list of DMR
        """
        # Spacing between consecutive grid points (uniform by linspace construction)
        grid_step = (grid_positions[-1] - grid_positions[0]) / (len(grid_positions) - 1)
        # Two runs are merged if separated by ≤ 1.5 grid steps (~1 non-sig point)
        merge_gap = grid_step * 1.5

        # --- Step 1: Collect contiguous significant runs as (start_idx, end_idx) ---
        raw_runs = []
        in_dmr = False
        start_idx = 0

        for i, sig in enumerate(is_sig):
            if sig and not in_dmr:
                # Start of a new significant run
                start_idx = i
                in_dmr = True
            elif not sig and in_dmr:
                # End of current run (exclusive: last sig point was i-1)
                raw_runs.append((start_idx, i - 1))
                in_dmr = False
        # Close any run that extends to the last grid point
        if in_dmr:
            raw_runs.append((start_idx, len(is_sig) - 1))

        if not raw_runs:
            return []  # no significant grid points at all

        # --- Step 2: Merge nearby runs ---
        merged = [raw_runs[0]]
        for run_start, run_end in raw_runs[1:]:
            prev_start, prev_end = merged[-1]
            # If the gap between this run's start and the previous run's end
            # is within one grid step, absorb this run into the previous DMR
            if grid_positions[run_start] - grid_positions[prev_end] <= merge_gap:
                merged[-1] = (prev_start, run_end)
            else:
                merged.append((run_start, run_end))

        # --- Step 3: Convert index pairs to DMR objects ---
        dmrs = []
        half_step = grid_step / 2
        for start_idx, end_idx in merged:
            s = grid_positions[start_idx]
            e = grid_positions[end_idx]
            if start_idx == end_idx:
                # Single-point DMR: the GP posterior at this point represents
                # a neighborhood of ±half_step, not just one base pair
                s -= half_step
                e += half_step
            # --- Step 4: Width filter ---
            if e - s >= min_width_bp:
                dmr = self._make_dmr(
                    grid_positions, diff_mean, prob_pos,
                    start_idx, end_idx
                )
                # Override coordinates with potentially expanded boundaries
                dmr.start = int(s)
                dmr.end = int(e)
                dmr.width_bp = int(e - s)
                dmrs.append(dmr)

        return dmrs

    def _make_dmr(self, grid, diff_mean, prob_pos, si, ei):
        """
        Compute summary statistics for a DMR spanning grid indices si to ei.

        Parameters
        ----------
        grid : ndarray
            Grid positions
        diff_mean : ndarray
            Posterior mean difference at each grid point
        prob_pos : ndarray
            Posterior probability at each grid point
        si, ei : int
            Start and end indices into grid (inclusive)

        Returns
        -------
        DMR
        """
        s = int(grid[si])
        e = int(grid[ei])
        # Slice covering all grid points in this DMR
        mask = slice(si, ei + 1)
        dm = diff_mean[mask]
        pp = prob_pos[mask]

        # Find which annotations overlap this DMR's genomic interval
        overlapping = []
        for ann in self.annotations:
            # Half-open interval overlap: annotation must start before DMR end
            # and end after DMR start
            if ann.end > s and ann.start < e:
                overlapping.append(ann.name)

        return DMR(
            chrom=self.chrom, start=s, end=e,
            width_bp=e - s,
            # max absolute delta-beta captures the peak effect size
            max_delta_beta=float(np.max(np.abs(dm))),
            # mean signed delta-beta indicates direction (positive = B > A)
            mean_delta_beta=float(np.mean(dm)),
            # mean posterior probability across the DMR (confidence measure)
            mean_posterior_prob=float(np.mean(pp)),
            overlapping_annotations=overlapping,
        )

    # -----------------------------------------------------------------
    # OUTPUT
    # -----------------------------------------------------------------

    def to_dataframe(self, results: Optional[GPDMResults] = None) -> pd.DataFrame:
        """
        Export grid-level posterior predictions as a tidy DataFrame.

        Column names for group-specific predictions use the actual group labels
        (e.g., "pred_tumor", "std_normal") so downstream code does not need
        to hard-code group names.

        Parameters
        ----------
        results : GPDMResults, optional
            Defaults to self.results (primary results from run())

        Returns
        -------
        DataFrame with columns:
            chrom, position, pred_{groupA}, std_{groupA},
            pred_{groupB}, std_{groupB}, diff_mean, diff_std,
            ci_lower, ci_upper, prob_B_greater, is_significant
        """
        if results is None:
            results = self.results
        if results is None:
            raise ValueError("Run analysis first")

        df = pd.DataFrame({
            "chrom": self.chrom,
            "position": results.grid_positions.astype(int),
            # Dynamic column names based on actual group labels
            f"pred_{results.group_A_name}": results.pred_A,
            f"std_{results.group_A_name}": results.std_A,
            f"pred_{results.group_B_name}": results.pred_B,
            f"std_{results.group_B_name}": results.std_B,
            "diff_mean": results.diff_mean,
            "diff_std": results.diff_std,
            "ci_lower": results.ci_lower,
            "ci_upper": results.ci_upper,
            # Note: named "prob_B_greater" for clarity in the exported format
            "prob_B_greater": results.prob_positive,
            "is_significant": results.is_significant,
        })
        return df

    def dmrs_to_dataframe(self, results: Optional[GPDMResults] = None) -> pd.DataFrame:
        """
        Export DMRs as a BED-like DataFrame.

        Each row is one DMR with coordinates, effect size, confidence, and
        overlapping annotation labels.

        Parameters
        ----------
        results : GPDMResults, optional
            Defaults to self.results

        Returns
        -------
        DataFrame with columns:
            chrom, start, end, width_bp, max_delta_beta,
            mean_delta_beta, mean_posterior_prob, annotations
        """
        if results is None:
            results = self.results
        if results is None:
            raise ValueError("Run analysis first")

        rows = []
        for dmr in results.dmrs:
            rows.append({
                "chrom": dmr.chrom,
                "start": dmr.start,
                "end": dmr.end,
                "width_bp": dmr.width_bp,
                "max_delta_beta": dmr.max_delta_beta,
                "mean_delta_beta": dmr.mean_delta_beta,
                "mean_posterior_prob": dmr.mean_posterior_prob,
                # Comma-joined annotation names for compact tabular output
                "annotations": ",".join(dmr.overlapping_annotations),
            })
        return pd.DataFrame(rows)

    def dmrs_to_bed(self, path: str, results: Optional[GPDMResults] = None):
        """
        Export DMRs as a standard BED file for genome browser viewing.

        The BED score field (0-1000) encodes mean_posterior_prob × 1000,
        so high-confidence DMRs appear more prominently in browsers that
        scale track height or color by score.

        Parameters
        ----------
        path : str
            Output file path
        results : GPDMResults, optional
            Defaults to self.results
        """
        if results is None:
            results = self.results
        with open(path, 'w') as f:
            # BED track header for UCSC/IGV genome browsers
            f.write(f'track name="GPDM_DMRs" description="GP Differential Methylation"\n')
            for dmr in results.dmrs:
                # Scale probability to BED score range [0, 1000]
                score = int(min(dmr.mean_posterior_prob * 1000, 1000))
                # Embed effect size in the BED name field for easy inspection
                name = f"DMR_db{dmr.max_delta_beta:.3f}"
                f.write(f"{dmr.chrom}\t{dmr.start}\t{dmr.end}\t{name}\t{score}\n")

    # -----------------------------------------------------------------
    # VISUALIZATION
    # -----------------------------------------------------------------

    def plot_results(
        self,
        results: Optional[GPDMResults] = None,
        save_path: Optional[str] = None,
        figsize: Tuple[int, int] = (14, 14),
        dpi: int = 150,
        dark_theme: bool = True,
    ):
        """
        Generate a 4-panel publication-quality results figure.

        Panels (top to bottom):
        0. Annotation track — color-coded regulatory domain boundaries
        1. GP methylation fits — scatter of observed means + posterior mean ±1.96σ bands
        2. Difference function — Delta(x) with significant regions highlighted
        3. Posterior probability heatmap — P(Delta > 0) as a color strip + line plot

        Parameters
        ----------
        results : GPDMResults, optional
            Defaults to self.results
        save_path : str, optional
            If provided, save the figure to this path
        figsize : tuple
            Figure size in inches (width, height)
        dpi : int
            Resolution for saved figure
        dark_theme : bool
            Use dark background (True) or light background (False)
        """
        if results is None:
            results = self.results
        if results is None:
            raise ValueError("Run analysis first")

        import matplotlib.pyplot as plt
        import matplotlib.gridspec as gridspec

        # Color palette for dark or light theme
        if dark_theme:
            c = {
                "A": "#06b6d4",    # cyan for group A
                "B": "#f59e0b",    # amber for group B
                "diff": "#10b981", # green for difference line
                "dmr": "#ec4899",  # pink for significant DMR regions
                "true": "#ffffff", # white for reference lines
                "bg": "#0a0e1a",   # near-black background
                "panel": "#111827", # dark panel background
                "grid": "#1e293b", # dark grid lines
                "text": "#e2e8f0", # light text
                "muted": "#64748b",# muted/secondary text
                "accent": "#8b5cf6",# accent color for titles
            }
        else:
            c = {
                "A": "#0891b2", "B": "#d97706", "diff": "#059669",
                "dmr": "#db2777", "true": "#000000", "bg": "#ffffff",
                "panel": "#f8fafc", "grid": "#e2e8f0", "text": "#1e293b",
                "muted": "#94a3b8", "accent": "#7c3aed",
            }

        gp = results.grid_positions  # shorthand for repeated use below

        fig = plt.figure(figsize=figsize, facecolor=c["bg"])
        # GridSpec: 4 rows with height ratios [annotation, GP fits, difference, probability]
        gs = gridspec.GridSpec(
            4, 1, height_ratios=[0.08, 1.2, 1.0, 0.4],
            hspace=0.06, left=0.08, right=0.96, top=0.94, bottom=0.05,
        )

        def style_ax(ax, ylabel="", show_x=False):
            """Apply consistent axis styling to a panel."""
            ax.set_facecolor(c["panel"])
            ax.tick_params(colors=c["muted"], labelsize=8)
            if ylabel:
                ax.set_ylabel(ylabel, color=c["text"], fontsize=10, fontweight=500)
            for sp in ax.spines.values():
                sp.set_color(c["grid"])
            ax.grid(True, alpha=0.12, color=c["grid"])
            ax.set_xlim(self.start, self.end)  # all panels share x-axis range
            if not show_x:
                ax.tick_params(labelbottom=False)  # hide x labels except bottom panel
            else:
                ax.set_xlabel(f"Genomic Position ({self.chrom})",
                             color=c["text"], fontsize=10)
            ax.ticklabel_format(axis='x', style='plain', useOffset=False)

        # Figure-level title
        method_label = ("Annotation-Aware GP" if results.method == "annotation_aware"
                       else "Naive GP")
        fig.suptitle(
            f"GPDM: {method_label} — {self.chrom}:{self.start:,}-{self.end:,}",
            color=c["text"], fontsize=14, fontweight=700,
            fontfamily="monospace", y=0.97,
        )

        # --- Panel 0: Annotation track ---
        ax0 = fig.add_subplot(gs[0])
        ax0.set_facecolor(c["bg"])
        for sp in ax0.spines.values():
            sp.set_visible(False)
        ax0.set_xlim(self.start, self.end)
        ax0.set_ylim(0, 1)
        ax0.set_yticks([])
        ax0.tick_params(labelbottom=False, length=0)

        for ann in self.annotations:
            # Color-filled span for each annotation domain
            ax0.axvspan(ann.start, ann.end, alpha=0.6, color=ann.color)
            # Short label centered in the domain
            mid = (ann.start + ann.end) / 2
            ax0.text(mid, 0.5, ann.short_label, ha="center", va="center",
                    fontsize=7, fontweight=700, color=c["text"],
                    fontfamily="monospace")

        # --- Panel 1: GP methylation fits ---
        ax1 = fig.add_subplot(gs[1])
        # Faint annotation coloring behind the scatter for visual alignment
        for ann in self.annotations:
            ax1.axvspan(ann.start, ann.end, alpha=0.03, color=ann.color)

        # Observed per-CpG group means as scatter points
        ax1.scatter(self.positions, self.mean_A, s=18, alpha=0.5,
                   color=c["A"], linewidths=0, zorder=3,
                   label=f"{results.group_A_name} (observed)")
        ax1.scatter(self.positions, self.mean_B, s=18, alpha=0.5,
                   color=c["B"], linewidths=0, zorder=3,
                   label=f"{results.group_B_name} (observed)")

        # Group A: posterior mean ±1.96σ credible band
        ax1.fill_between(gp, results.pred_A - 1.96*results.std_A,
                         results.pred_A + 1.96*results.std_A,
                         alpha=0.15, color=c["A"], zorder=2)
        ax1.plot(gp, results.pred_A, color=c["A"], lw=2, zorder=4,
                label=f"{results.group_A_name} (GP)")

        # Group B: posterior mean ±1.96σ credible band
        ax1.fill_between(gp, results.pred_B - 1.96*results.std_B,
                         results.pred_B + 1.96*results.std_B,
                         alpha=0.15, color=c["B"], zorder=2)
        ax1.plot(gp, results.pred_B, color=c["B"], lw=2, zorder=4,
                label=f"{results.group_B_name} (GP)")

        style_ax(ax1, ylabel="β-value")
        ax1.set_ylim(-0.02, 1.02)  # beta values bounded to [0, 1]
        ax1.legend(loc="upper right", fontsize=8, framealpha=0.3,
                  facecolor=c["panel"], edgecolor=c["grid"],
                  labelcolor=c["text"])

        # --- Panel 2: Difference function ---
        ax2 = fig.add_subplot(gs[2])
        for ann in self.annotations:
            ax2.axvspan(ann.start, ann.end, alpha=0.03, color=ann.color)

        # Horizontal reference line at Delta = 0 (no difference)
        ax2.axhline(0, color=c["muted"], lw=0.8, ls="--")

        # Fill significant regions (CI excludes zero) in DMR color
        ax2.fill_between(gp, results.ci_lower, results.ci_upper,
                         where=results.is_significant, alpha=0.3,
                         color=c["dmr"], label="Significant DMR")
        # Fill non-significant regions in muted diff color
        ax2.fill_between(gp, results.ci_lower, results.ci_upper,
                         where=~results.is_significant, alpha=0.12,
                         color=c["diff"], label="Non-significant")
        # Posterior mean difference line on top
        ax2.plot(gp, results.diff_mean, color=c["diff"], lw=2.5,
                label="Δ(x) posterior mean")

        # Annotate each called DMR with its width and effect size
        for dmr in results.dmrs:
            mid = (dmr.start + dmr.end) / 2
            mask = (gp >= dmr.start) & (gp <= dmr.end)
            if mask.any():
                # Place label at the peak of the difference within this DMR
                peak = results.diff_mean[mask][np.argmax(np.abs(results.diff_mean[mask]))]
                w_kb = dmr.width_bp / 1000
                ax2.annotate(
                    f"{w_kb:.1f}kb | Δβ={dmr.max_delta_beta:.3f}\nP={dmr.mean_posterior_prob:.3f}",
                    xy=(mid, peak), fontsize=7, color=c["dmr"],
                    fontweight=600, fontfamily="monospace",
                    ha="center", va="bottom" if peak > 0 else "top",
                    bbox=dict(boxstyle="round,pad=0.2", fc=c["panel"],
                             ec=c["dmr"], alpha=0.9),
                )

        style_ax(ax2, ylabel=f"Δβ ({results.group_B_name} − {results.group_A_name})")
        ax2.legend(loc="upper right", fontsize=8, framealpha=0.3,
                  facecolor=c["panel"], edgecolor=c["grid"],
                  labelcolor=c["text"])

        # --- Panel 3: Posterior probability heatmap + line ---
        ax3 = fig.add_subplot(gs[3])
        # Vertical color strips: each strip colored by P(Delta > 0)
        # RdBu_r: blue=low probability (group A > B), red=high (group B > A)
        for i in range(len(gp) - 1):
            prob = results.prob_positive[i]
            color = plt.cm.RdBu_r(0.05 + 0.9 * prob)  # map to [0.05, 0.95] to avoid clipping
            ax3.axvspan(gp[i], gp[i+1], color=color, alpha=0.7)

        # Overlay probability line for precise reading
        ax3.plot(gp, results.prob_positive, color=c["text"], lw=1.2)
        # Significance threshold line at the 95% CI equivalent
        ax3.axhline(0.975, color=c["dmr"], lw=0.8, ls=":", alpha=0.5)
        # Reference line at P=0.5 (no differential methylation)
        ax3.axhline(0.5, color=c["muted"], lw=0.5, alpha=0.3)

        style_ax(ax3, ylabel=f"P(Δ>0)", show_x=True)
        ax3.set_ylim(0, 1)

        if save_path:
            fig.savefig(save_path, dpi=dpi, facecolor=c["bg"],
                       bbox_inches="tight")
            log.info(f"\nSaved figure to: {save_path}")

        return fig

    def plot_comparison(
        self,
        save_path: Optional[str] = None,
        figsize: Tuple[int, int] = (18, 10),
        dpi: int = 150,
    ):
        """
        Side-by-side 2×2 grid comparing naive and annotation-aware GP results.

        Top row: GP methylation fits for each method.
        Bottom row: Difference function with DMR calls for each method.

        Useful for assessing how much the annotation-aware approach changes
        the posterior predictions and DMR calls compared to the naive model.
        Requires running with method="both" first.

        Parameters
        ----------
        save_path : str, optional
            If provided, save the figure to this path
        figsize : tuple
            Figure size in inches
        dpi : int
            Resolution for saved figure

        Returns
        -------
        matplotlib Figure
        """
        if self.results_naive is None or self.results_annotation is None:
            raise ValueError("Run with method='both' first")

        import matplotlib.pyplot as plt

        fig, axes = plt.subplots(2, 2, figsize=figsize, facecolor="#0a0e1a")
        fig.suptitle("Naive GP vs Annotation-Aware GP",
                    color="#e2e8f0", fontsize=14, fontweight=700,
                    fontfamily="monospace")

        for col, (res, label) in enumerate([
            (self.results_naive, "Naive GP"),
            (self.results_annotation, "Annotation-Aware GP"),
        ]):
            gp = res.grid_positions
            c_diff, c_dmr = "#10b981", "#ec4899"

            # Top row: GP fits for both groups
            ax = axes[0, col]
            ax.set_facecolor("#111827")
            ax.plot(gp, res.pred_A, color="#06b6d4", lw=2)  # group A
            ax.plot(gp, res.pred_B, color="#f59e0b", lw=2)  # group B
            # 95% CI bands for each group
            ax.fill_between(gp, res.pred_A-1.96*res.std_A,
                           res.pred_A+1.96*res.std_A, alpha=0.12, color="#06b6d4")
            ax.fill_between(gp, res.pred_B-1.96*res.std_B,
                           res.pred_B+1.96*res.std_B, alpha=0.12, color="#f59e0b")
            ax.set_title(label, color="#8b5cf6", fontsize=11, fontweight=700,
                        fontfamily="monospace")
            ax.set_xlim(self.start, self.end)
            ax.tick_params(colors="#64748b", labelsize=7)
            for sp in ax.spines.values():
                sp.set_color("#1e293b")

            # Bottom row: difference function with DMR calls
            ax = axes[1, col]
            ax.set_facecolor("#111827")
            ax.axhline(0, color="#64748b", lw=0.8, ls="--")  # zero reference
            # Significant regions filled in DMR color
            ax.fill_between(gp, res.ci_lower, res.ci_upper,
                           where=res.is_significant, alpha=0.3, color=c_dmr)
            # Non-significant CI band in green
            ax.fill_between(gp, res.ci_lower, res.ci_upper,
                           where=~res.is_significant, alpha=0.12, color=c_diff)
            ax.plot(gp, res.diff_mean, color=c_diff, lw=2)
            ax.set_xlim(self.start, self.end)
            ax.tick_params(colors="#64748b", labelsize=7)
            for sp in ax.spines.values():
                sp.set_color("#1e293b")

            # DMR count overlay in the top-left corner of the panel
            ax.text(0.02, 0.95, f"{len(res.dmrs)} DMR(s)",
                   transform=ax.transAxes, color=c_dmr,
                   fontsize=9, fontweight=700, fontfamily="monospace",
                   va="top")

        plt.tight_layout()
        if save_path:
            fig.savefig(save_path, dpi=dpi, facecolor="#0a0e1a",
                       bbox_inches="tight")
        return fig
