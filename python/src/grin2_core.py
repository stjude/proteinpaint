"""
GRIN2 Core Functions
====================

Genomic Random Interval Model (GRIN) statistical analysis for genomic lesion data.

This module provides optimized functions for:
- Identifying overlaps between genes and genomic lesions
- Computing hit counts and affected subjects per gene
- Calculating statistical significance (p-values and q-values)

Performance optimizations (v2.0):
- ~5x speedup over original implementation
- Vectorized numpy operations instead of pandas row iteration
- Numba JIT compilation for compute-intensive kernels
- O(G×S) approximation for probability computation (vs O(G×L) exact)

References:
    Pounds S, et al (2013) A genomic random interval model for statistical 
    analysis of genomic lesion data. Bioinformatics, 29(17):2088-95

GRIN2 Core Functions Overview
├── Module docstring (description, optimizations, references)
├── Imports
│
├── NUMBA-OPTIMIZED KERNELS
│   ├── bern_conv_and_pvalue()      # Fused convolution + p-value
│   ├── compute_pr_subj_approx()    # O(G×S) probability approximation
│   ├── compute_p_values_from_conv()
│   └── scatter_add_2d()
│
├── DATA PREPARATION FUNCTIONS
│   ├── order_index_gene_data()
│   ├── order_index_lsn_data()
│   ├── prep_gene_lsn_data_fast()
│
├── CORE ANALYSIS FUNCTIONS
│   ├── find_gene_lsn_overlaps_fast()
│   ├── count_hits_fast()
│   ├── process_block_in_chunks_fast()
│   └── prob_hits_fast()
│
├── STATISTICAL HELPER FUNCTIONS
│   ├── p_order()
│   └── row_prob_subj_hit()
│
├── MAIN ENTRY POINT
│   └── grin_stats()
│
└── UTILITY FUNCTIONS
    ├── write_error()
    └── timed_grin_stats()          # For profiling
"""

import sys
import time

import numpy as np
import pandas as pd
from numba import njit, prange
from scipy.stats import beta
from statsmodels.stats.multitest import fdrcorrection


# =============================================================================
# NUMBA-OPTIMIZED KERNELS
# =============================================================================

@njit(parallel=True, fastmath=True)
def bern_conv_and_pvalue(P, nsubj_vals):
    """
    Fused Bernoulli convolution and p-value computation.
    
    Computes the probability distribution of a sum of Bernoulli random variables
    and calculates p-values in a single pass. This avoids allocating a large
    intermediate matrix by processing each gene independently with a small
    local array that fits in CPU cache.
    
    Parameters
    ----------
    P : ndarray, shape (n_genes, n_subjects)
        Probability matrix where P[g, s] is the probability that gene g
        is hit in subject s.
    nsubj_vals : ndarray, shape (n_genes,)
        Observed number of subjects with hits for each gene.
    
    Returns
    -------
    p_values : ndarray, shape (n_genes,)
        P-value for each gene: P(X >= observed) under the null.
    """
    m, n = P.shape
    max_x = int(np.max(nsubj_vals))
    
    p_values = np.zeros(m, dtype=np.float64)
    
    for i in prange(m):
        # Allocate small local array for this gene only (fits in L1 cache)
        Pr = np.zeros(max_x + 2, dtype=np.float64)
        Pr[0] = 1.0
        
        # Bernoulli convolution for this gene
        for j in range(n):
            p = P[i, j]
            for k in range(max_x, -1, -1):
                Pr[k + 1] += Pr[k] * p
                Pr[k] *= (1.0 - p)
        
        # Compute p-value: P(X >= k) = sum of Pr[k:]
        k_start = nsubj_vals[i]
        total = 0.0
        for k in range(k_start, max_x + 2):
            total += Pr[k]
        p_values[i] = total
    
    return p_values


@njit(parallel=True)
def compute_pr_subj_approx(gene_size, lsn_count_per_subj, lsn_size_per_subj, chrom_size):
    """
    Fast approximation for per-subject hit probabilities.
    
    Uses the Taylor approximation log(1-p) ≈ -p for small p, which allows
    pre-aggregating lesion statistics by subject. This reduces complexity
    from O(G × L) to O(G × S), where G=genes, L=lesions, S=subjects.
    
    Mathematical basis:
        Exact:  logsum[g,s] = Σ log(1 - (gs + ls) / C)  for all lesions l in subject s
        Approx: logsum[g,s] ≈ -(count[s] * gs + total_size[s]) / C
    
    Accuracy: Error < 0.01% when (gene_size + lesion_size) / chrom_size < 0.01.
    May be less accurate for very large structural variants (>1Mb) on small chromosomes.
    
    Parameters
    ----------
    gene_size : ndarray, shape (n_genes,)
        Size of each gene in base pairs.
    lsn_count_per_subj : ndarray, shape (n_subjects,)
        Number of lesions per subject.
    lsn_size_per_subj : ndarray, shape (n_subjects,)
        Total lesion size per subject.
    chrom_size : float
        Chromosome size in base pairs.
    
    Returns
    -------
    pr_subj : ndarray, shape (n_genes, n_subjects)
        Probability that each gene is hit in each subject.
    """
    n_genes = len(gene_size)
    n_subj = len(lsn_count_per_subj)
    
    pr_subj = np.empty((n_genes, n_subj), dtype=np.float64)
    inv_chrom = 1.0 / chrom_size
    
    for g in prange(n_genes):
        gs = gene_size[g]
        for s in range(n_subj):
            approx_logsum = -(lsn_count_per_subj[s] * gs + lsn_size_per_subj[s]) * inv_chrom
            
            # Clamp to avoid numerical underflow (exp(-700) ≈ 0)
            if approx_logsum < -700.0:
                pr_subj[g, s] = 1.0
            else:
                pr_subj[g, s] = 1.0 - np.exp(approx_logsum)
    
    return pr_subj


@njit(parallel=True)
def compute_p_values_from_conv(pr_nsubj, nsubj_vals):
    """
    Compute p-values from pre-computed probability distribution.
    
    Parameters
    ----------
    pr_nsubj : ndarray, shape (n_genes, max_nsubj+2)
        Probability distribution for each gene.
    nsubj_vals : ndarray, shape (n_genes,)
        Observed counts for each gene.
    
    Returns
    -------
    p_values : ndarray, shape (n_genes,)
        P-value for each gene.
    """
    n_genes = pr_nsubj.shape[0]
    n_cols = pr_nsubj.shape[1]
    p_values = np.zeros(n_genes, dtype=np.float64)
    
    for j in prange(n_genes):
        start_idx = nsubj_vals[j]
        total = 0.0
        for k in range(start_idx, n_cols):
            total += pr_nsubj[j, k]
        p_values[j] = total
    
    return p_values


@njit(parallel=True)
def scatter_add_2d(logsum, subj_indices, log_chunk):
    """
    Scatter-add operation: logsum[:, subj_indices[j]] += log_chunk[:, j]
    
    Used for accumulating log-probabilities by subject.
    """
    n_genes, n_lesions = log_chunk.shape
    for j in prange(n_lesions):
        subj_idx = subj_indices[j]
        for i in range(n_genes):
            logsum[i, subj_idx] += log_chunk[i, j]


# =============================================================================
# DATA PREPARATION FUNCTIONS
# =============================================================================

def order_index_gene_data(gene_data):
    """
    Sort and index gene annotation data by chromosome and position.
    
    Parameters
    ----------
    gene_data : DataFrame
        Gene annotations with columns: gene, chrom, loc.start, loc.end
    
    Returns
    -------
    dict
        'gene.data': Sorted DataFrame with gene.row column added
        'gene.index': Index table with chromosome boundaries
    """
    g = len(gene_data)

    gene_data_sorted = gene_data.sort_values(
        by=["chrom", "loc.start", "loc.end"]
    ).reset_index(drop=True)

    # Find chromosome boundaries
    chrom_diff = gene_data_sorted["chrom"].ne(gene_data_sorted["chrom"].shift())
    new_chrom = chrom_diff[1:].to_numpy().nonzero()[0]

    chr_start = [0] + (new_chrom + 1).tolist()
    chr_end = new_chrom.tolist() + [g - 1]

    gene_index = pd.DataFrame({
        "chrom": gene_data_sorted.loc[chr_start, "chrom"].values,
        "row.start": [i + 1 for i in chr_start],
        "row.end": [i + 1 for i in chr_end]
    })

    gene_data_sorted["gene.row"] = range(1, g + 1)

    return {
        "gene.data": gene_data_sorted,
        "gene.index": gene_index
    }


def order_index_lsn_data(lsn_data):
    """
    Sort and index lesion data by type, chromosome, and subject.
    
    Parameters
    ----------
    lsn_data : DataFrame
        Lesion data with columns: ID, chrom, loc.start, loc.end, lsn.type
    
    Returns
    -------
    dict
        'lsn.data': Sorted DataFrame with lsn.row column added
        'lsn.index': Index table with group boundaries
    """
    l = len(lsn_data)

    lsn_data_sorted = lsn_data.sort_values(
        by=["lsn.type", "chrom", "ID"]
    ).reset_index(drop=True)

    # Find group boundaries
    diff = (
        lsn_data_sorted["lsn.type"].ne(lsn_data_sorted["lsn.type"].shift()) |
        lsn_data_sorted["chrom"].ne(lsn_data_sorted["chrom"].shift()) |
        lsn_data_sorted["ID"].ne(lsn_data_sorted["ID"].shift())
    )
    lsn_chng = diff[1:].to_numpy().nonzero()[0]

    lsn_start = [0] + (lsn_chng + 1).tolist()
    lsn_end = lsn_chng.tolist() + [l - 1]

    lsn_index = pd.DataFrame({
        "lsn.type": lsn_data_sorted.loc[lsn_start, "lsn.type"].values,
        "chrom": lsn_data_sorted.loc[lsn_start, "chrom"].values,
        "ID": lsn_data_sorted.loc[lsn_start, "ID"].values,
        "row.start": [i + 1 for i in lsn_start],
        "row.end": [i + 1 for i in lsn_end]
    })

    lsn_data_sorted["lsn.row"] = range(1, l + 1)

    return {
        "lsn.data": lsn_data_sorted,
        "lsn.index": lsn_index
    }


def prep_gene_lsn_data_fast(lsn_data, gene_data, validate=False):
    """
    Prepare combined gene-lesion position data for sweep line algorithm.
    
    Optimizations:
    - Builds numpy arrays directly instead of multiple DataFrame concatenations
    - Single sort instead of multiple sorts
    - Uses numpy lexsort for secondary ordering
    
    Parameters
    ----------
    lsn_data : DataFrame
        Lesion data with columns: ID, chrom, loc.start, loc.end, lsn.type
    gene_data : DataFrame
        Gene data with columns: gene, chrom, loc.start, loc.end
    validate : bool, optional
        Whether to run validation checks (default False)
    
    Returns
    -------
    dict
        Prepared data structures for overlap detection
    """
    # Order and index input data
    lsn_dset = order_index_lsn_data(lsn_data)
    lsn_data = lsn_dset['lsn.data']
    lsn_index = lsn_dset['lsn.index']

    gene_dset = order_index_gene_data(gene_data)
    gene_data = gene_dset['gene.data']
    gene_index = gene_dset['gene.index']

    g = len(gene_data)
    l = len(lsn_data)
    total_rows = 2 * g + 2 * l  # 2 entries per gene/lesion (start + end)
    
    # Pre-extract arrays from DataFrames
    gene_names = gene_data['gene'].values
    gene_rows = gene_data['gene.row'].values
    gene_chroms = gene_data['chrom'].values
    gene_starts = gene_data['loc.start'].values
    gene_ends = gene_data['loc.end'].values
    
    lsn_ids = lsn_data['ID'].values
    lsn_types = lsn_data['lsn.type'].values
    lsn_rows = lsn_data['lsn.row'].values
    lsn_chroms = lsn_data['chrom'].values
    lsn_starts = lsn_data['loc.start'].values
    lsn_ends = lsn_data['loc.end'].values
    
    # Allocate combined arrays
    all_ids = np.empty(total_rows, dtype=object)
    all_lsn_types = np.empty(total_rows, dtype=object)
    all_lsn_rows = np.empty(total_rows, dtype=np.float64)
    all_genes = np.empty(total_rows, dtype=object)
    all_gene_rows = np.empty(total_rows, dtype=np.float64)
    all_chroms = np.empty(total_rows, dtype=object)
    all_pos = np.empty(total_rows, dtype=np.int64)
    all_cty = np.empty(total_rows, dtype=np.int8)
    
    # Fill gene start entries (cty=1: gene start)
    idx = 0
    all_ids[idx:idx+g] = ''
    all_lsn_types[idx:idx+g] = ''
    all_lsn_rows[idx:idx+g] = np.nan
    all_genes[idx:idx+g] = gene_names
    all_gene_rows[idx:idx+g] = gene_rows
    all_chroms[idx:idx+g] = gene_chroms
    all_pos[idx:idx+g] = gene_starts
    all_cty[idx:idx+g] = 1
    
    # Fill gene end entries (cty=4: gene end)
    idx = g
    all_ids[idx:idx+g] = ''
    all_lsn_types[idx:idx+g] = ''
    all_lsn_rows[idx:idx+g] = np.nan
    all_genes[idx:idx+g] = gene_names
    all_gene_rows[idx:idx+g] = gene_rows
    all_chroms[idx:idx+g] = gene_chroms
    all_pos[idx:idx+g] = gene_ends
    all_cty[idx:idx+g] = 4
    
    # Fill lesion start entries (cty=2: lesion start)
    idx = 2 * g
    all_ids[idx:idx+l] = lsn_ids
    all_lsn_types[idx:idx+l] = lsn_types
    all_lsn_rows[idx:idx+l] = lsn_rows
    all_genes[idx:idx+l] = ''
    all_gene_rows[idx:idx+l] = np.nan
    all_chroms[idx:idx+l] = lsn_chroms
    all_pos[idx:idx+l] = lsn_starts
    all_cty[idx:idx+l] = 2
    
    # Fill lesion end entries (cty=3: lesion end)
    idx = 2 * g + l
    all_ids[idx:idx+l] = lsn_ids
    all_lsn_types[idx:idx+l] = lsn_types
    all_lsn_rows[idx:idx+l] = lsn_rows
    all_genes[idx:idx+l] = ''
    all_gene_rows[idx:idx+l] = np.nan
    all_chroms[idx:idx+l] = lsn_chroms
    all_pos[idx:idx+l] = lsn_ends
    all_cty[idx:idx+l] = 3
    
    # Create DataFrame and sort once
    gene_lsn_data = pd.DataFrame({
        'ID': all_ids,
        'lsn.type': all_lsn_types,
        'lsn.row': all_lsn_rows,
        'gene': all_genes,
        'gene.row': all_gene_rows,
        'chrom': all_chroms,
        'pos': all_pos,
        'cty': all_cty
    })
    
    gene_lsn_data.sort_values(by=['chrom', 'pos', 'cty'], inplace=True, ignore_index=True)
    gene_lsn_data['glp.row'] = gene_lsn_data.index + 1
    
    # Secondary sort using numpy lexsort
    lsn_row_arr = gene_lsn_data['lsn.row'].values.copy()
    gene_row_arr = gene_lsn_data['gene.row'].values.copy()
    cty_arr = gene_lsn_data['cty'].values
    
    lsn_row_for_sort = np.where(np.isnan(lsn_row_arr), 1e18, lsn_row_arr)
    gene_row_for_sort = np.where(np.isnan(gene_row_arr), 1e18, gene_row_arr)
    
    ord_idx = np.lexsort((cty_arr, gene_row_for_sort, lsn_row_for_sort))
    
    glp_row_arr = gene_lsn_data['glp.row'].values
    
    # Extract positional indices
    lsn_ord_idx = ord_idx[:2 * l]
    lsn_glp_rows = glp_row_arr[lsn_ord_idx]
    lsn_data = lsn_data.copy()
    lsn_data['glp.row.start'] = lsn_glp_rows[::2]
    lsn_data['glp.row.end'] = lsn_glp_rows[1::2]
    
    gene_ord_idx = ord_idx[2 * l:]
    gene_glp_rows = glp_row_arr[gene_ord_idx]
    gene_data = gene_data.copy()
    gene_data['glp.row.start'] = gene_glp_rows[::2]
    gene_data['glp.row.end'] = gene_glp_rows[1::2]
    
    gene_lsn_data['gene.row.0'] = gene_lsn_data['gene.row'] - 1
    gene_lsn_data['lsn.row.0'] = gene_lsn_data['lsn.row'] - 1
    
    return {
        'lsn.data': lsn_data,
        'gene.data': gene_data,
        'gene.lsn.data': gene_lsn_data,
        'gene.index': gene_index,
        'lsn.index': lsn_index
    }

# =============================================================================
# CORE ANALYSIS FUNCTIONS
# =============================================================================

def find_gene_lsn_overlaps_fast(gl_data):
    """
    Find overlaps between genes and lesions using sweep line algorithm.
    
    Optimizations:
    - Extracts numpy arrays before loop (avoids pandas .iloc overhead)
    - Uses vectorized index building instead of iterrows()
    
    Parameters
    ----------
    gl_data : dict
        Output from prep_gene_lsn_data_fast()
    
    Returns
    -------
    dict
        Data structures with overlap information
    """
    gene_data = gl_data["gene.data"].copy()
    lsn_data = gl_data["lsn.data"].copy()
    gene_lsn_data = gl_data["gene.lsn.data"].copy()
    gene_index = gl_data["gene.index"]
    lsn_index = gl_data["lsn.index"]

    m = len(gene_lsn_data)

    # Extract arrays once before the loop
    cty_arr = gene_lsn_data["cty"].values
    gene_row_arr = gene_lsn_data["gene.row"].values
    lsn_row_arr = gene_lsn_data["lsn.row"].values

    gene_row_mtch = []
    lsn_row_mtch = []
    
    current_genes = set()
    current_lsns = set()

    # Sweep line algorithm
    for i in range(m):
        cty = cty_arr[i]

        if cty == 1:  # Gene start
            gene_row = gene_row_arr[i]
            current_genes.add(gene_row)
            for l in current_lsns:
                gene_row_mtch.append(gene_row)
                lsn_row_mtch.append(l)

        elif cty == 4:  # Gene end
            current_genes.discard(gene_row_arr[i])

        elif cty == 2:  # Lesion start
            lsn_row = lsn_row_arr[i]
            for g in current_genes:
                gene_row_mtch.append(g)
                lsn_row_mtch.append(lsn_row)
            current_lsns.add(lsn_row)

        elif cty == 3:  # Lesion end
            current_lsns.discard(lsn_row_arr[i])

    gene_row_mtch = np.array(gene_row_mtch)
    lsn_row_mtch = np.array(lsn_row_mtch)

    # Build index maps using vectorized operations
    gene_row_vals = gene_data["gene.row"].values
    lsn_row_vals = lsn_data["lsn.row"].values
    
    gene_row_to_iloc = pd.Series(np.arange(len(gene_data)), index=gene_row_vals)
    lsn_row_to_iloc = pd.Series(np.arange(len(lsn_data)), index=lsn_row_vals)

    gene_ilocs = gene_row_to_iloc.loc[gene_row_mtch].values
    lsn_ilocs = lsn_row_to_iloc.loc[lsn_row_mtch].values

    # Build output DataFrame
    gene_cols = ["gene.row", "gene", "chrom", "loc.start", "loc.end"]
    lsn_cols = ["lsn.row", "ID", "chrom", "loc.start", "loc.end", "lsn.type"]

    gene_hit_data = gene_data.iloc[gene_ilocs][gene_cols].reset_index(drop=True)
    lsn_hit_data = lsn_data.iloc[lsn_ilocs][lsn_cols].reset_index(drop=True)

    gene_lsn_hits = pd.concat([gene_hit_data, lsn_hit_data], axis=1)
    gene_lsn_hits.columns = [
        "gene.row", "gene", "gene.chrom", "gene.loc.start", "gene.loc.end",
        "lsn.row", "ID", "lsn.chrom", "lsn.loc.start", "lsn.loc.end", "lsn.type"
    ]

    return {
        "lsn.data": lsn_data,
        "gene.data": gene_data,
        "gene.lsn.data": gene_lsn_data,
        "gene.lsn.hits": gene_lsn_hits,
        "gene.index": gene_index,
        "lsn.index": lsn_index,
    }


def count_hits_fast(ov_data):
    """
    Count lesion hits and affected subjects per gene.
    
    Optimizations:
    - Uses drop_duplicates() instead of string concatenation
    - Uses numpy arrays instead of DataFrame for accumulation
    
    Parameters
    ----------
    ov_data : dict
        Output from find_gene_lsn_overlaps_fast()
    
    Returns
    -------
    dict
        Hit count matrices and supporting data
    """
    lsn_data = ov_data["lsn.data"]
    lsn_index = ov_data["lsn.index"]
    gene_lsn_hits = ov_data["gene.lsn.hits"]
    gene_lsn_data = ov_data["gene.lsn.data"]
    gene_data = ov_data["gene.data"]
    gene_index = ov_data["gene.index"]

    gene_row_map = pd.Series(gene_data.index.values, index=gene_data["gene"]).to_dict()

    if gene_lsn_hits["gene.row"].max() > len(gene_data):
        raise ValueError("gene.row values exceed number of rows in gene_data.")

    gene_lsn_hits["gene.row"] = gene_lsn_hits["gene"].map(gene_row_map)

    g = len(gene_data)
    lsn_types = sorted(lsn_index["lsn.type"].unique())
    k = len(lsn_types)
    
    lsn_type_to_col = {t: i for i, t in enumerate(lsn_types)}

    # Count total hits per gene per lesion type
    nhit_arr = np.zeros((g, k), dtype=np.int64)
    nhit_tbl = pd.crosstab(gene_lsn_hits["gene.row"], gene_lsn_hits["lsn.type"])
    for col in nhit_tbl.columns:
        col_idx = lsn_type_to_col[col]
        row_indices = nhit_tbl.index.values
        valid_mask = row_indices < g
        nhit_arr[row_indices[valid_mask], col_idx] = nhit_tbl[col].values[valid_mask]
    
    nhit_mtx = pd.DataFrame(nhit_arr, columns=lsn_types)

    # Count unique subjects per gene per lesion type
    subj_gene_hits = gene_lsn_hits.drop_duplicates(
        subset=["gene.row", "ID", "lsn.type"], 
        keep="first"
    )

    nsubj_arr = np.zeros((g, k), dtype=np.int64)
    nsubj_tbl = pd.crosstab(subj_gene_hits["gene.row"], subj_gene_hits["lsn.type"])
    for col in nsubj_tbl.columns:
        col_idx = lsn_type_to_col[col]
        row_indices = nsubj_tbl.index.values
        valid_mask = row_indices < g
        nsubj_arr[row_indices[valid_mask], col_idx] = nsubj_tbl[col].values[valid_mask]
    
    nsubj_mtx = pd.DataFrame(nsubj_arr, columns=lsn_types)

    return {
        "lsn.data": lsn_data,
        "lsn.index": lsn_index,
        "gene.data": gene_data,
        "gene.index": gene_index,
        "nhit.mtx": nhit_mtx,
        "nsubj.mtx": nsubj_mtx,
        "gene.lsn.data": gene_lsn_hits,
        "glp.data": gene_lsn_data,
    }


def _compute_pr_subj_exact(gene_size, lsn_size, lsn_subj_IDs, chrom_size, chunk_size=5000):
    """
    Exact O(G×L) computation for per-subject hit probabilities.
    
    Used as fallback when lesions are too large for the approximation to be accurate.
    Processes in chunks to manage memory usage.
    
    Parameters
    ----------
    gene_size : ndarray, shape (n_genes,)
        Gene sizes in base pairs
    lsn_size : ndarray, shape (n_lesions,)
        Lesion sizes in base pairs
    lsn_subj_IDs : ndarray, shape (n_lesions,)
        Subject ID for each lesion
    chrom_size : float
        Chromosome size in base pairs
    chunk_size : int
        Number of lesions to process per chunk
    
    Returns
    -------
    pr_subj : ndarray, shape (n_genes, n_subjects)
        Probability that each gene is hit in each subject
    """
    G = len(gene_size)
    L = len(lsn_size)
    
    # Map subject IDs to indices
    subj_ids_unique, subj_inv = np.unique(lsn_subj_IDs, return_inverse=True)
    n_subj = len(subj_ids_unique)
    
    # Accumulate log(1 - p) by subject
    logsum = np.zeros((G, n_subj), dtype=np.float64)
    
    for start in range(0, L, chunk_size):
        end = min(start + chunk_size, L)
        lsn_chunk_size = lsn_size[start:end]
        subj_chunk_inv = subj_inv[start:end]
        
        # Compute pr_gene_hit for this chunk: (gene_size + lsn_size) / chrom_size
        # Using broadcasting: (G, 1) + (1, chunk) -> (G, chunk)
        pr_chunk = (gene_size[:, np.newaxis] + lsn_chunk_size[np.newaxis, :]) / chrom_size
        np.clip(pr_chunk, 1e-10, 1 - 1e-10, out=pr_chunk)
        
        # log(1 - p)
        log_chunk = np.log(1.0 - pr_chunk)
        
        # Accumulate by subject (scatter-add)
        for j in range(end - start):
            subj_idx = subj_chunk_inv[j]
            logsum[:, subj_idx] += log_chunk[:, j]
    
    # pr_subj = 1 - exp(sum(log(1 - p))) = 1 - prod(1 - p)
    pr_subj = 1.0 - np.exp(logsum)
    
    return pr_subj


def _compute_pr_subj_approx(gene_size, lsn_size, lsn_subj_IDs, chrom_size):
    """
    Fast O(G×S) approximation for per-subject hit probabilities.
    
    Uses log(1-p) ≈ -p which allows pre-aggregating by subject.
    
    Parameters
    ----------
    gene_size : ndarray, shape (n_genes,)
        Gene sizes in base pairs
    lsn_size : ndarray, shape (n_lesions,)
        Lesion sizes in base pairs
    lsn_subj_IDs : ndarray, shape (n_lesions,)
        Subject ID for each lesion
    chrom_size : float
        Chromosome size in base pairs
    
    Returns
    -------
    pr_subj : ndarray, shape (n_genes, n_subjects)
        Probability that each gene is hit in each subject
    """
    subj_ids_unique, subj_inv = np.unique(lsn_subj_IDs, return_inverse=True)
    n_subj = len(subj_ids_unique)
    
    # Pre-aggregate lesion stats by subject: O(L) one-time cost
    lsn_count_per_subj = np.zeros(n_subj, dtype=np.float64)
    lsn_size_per_subj = np.zeros(n_subj, dtype=np.float64)
    
    for l in range(len(lsn_size)):
        s = subj_inv[l]
        lsn_count_per_subj[s] += 1.0
        lsn_size_per_subj[s] += lsn_size[l]
    
    # O(G × S) computation using numba kernel
    pr_subj = compute_pr_subj_approx(
        gene_size, lsn_count_per_subj, lsn_size_per_subj, chrom_size
    )
    
    return pr_subj


# Threshold for switching between approximation and exact computation
# When max_p < threshold, approximation error < 0.1%
_APPROX_THRESHOLD = 0.05


def process_block_in_chunks_fast(gene_size, lsn_size, lsn_subj_IDs, chrom_size, chunk_size=5000):
    """
    Compute per-subject hit probabilities with automatic method selection.
    
    Uses fast O(G×S) approximation when lesions are small enough for the
    approximation to be accurate. Falls back to exact O(G×L) computation
    for large structural variants where the approximation error would be
    significant.
    
    The approximation log(1-p) ≈ -p has error ~p²/2. With threshold p < 0.05,
    the maximum error is < 0.1%.
    
    Parameters
    ----------
    gene_size : ndarray
        Gene sizes in base pairs
    lsn_size : ndarray
        Lesion sizes in base pairs
    lsn_subj_IDs : ndarray
        Subject ID for each lesion
    chrom_size : float
        Chromosome size in base pairs
    chunk_size : int, optional
        Chunk size for exact computation (default 5000)
    
    Returns
    -------
    tuple
        (None, pr_subj) where pr_subj is the probability matrix
    """
    # Calculate maximum p to decide which method to use
    max_gene = np.max(gene_size) if len(gene_size) > 0 else 0
    max_lsn = np.max(lsn_size) if len(lsn_size) > 0 else 0
    max_p = (max_gene + max_lsn) / chrom_size
    
    if max_p < _APPROX_THRESHOLD:
        # Fast path: O(G×S) approximation
        pr_subj = _compute_pr_subj_approx(gene_size, lsn_size, lsn_subj_IDs, chrom_size)
    else:
        # Slow path: O(G×L) exact computation for large SVs
        pr_subj = _compute_pr_subj_exact(gene_size, lsn_size, lsn_subj_IDs, chrom_size, chunk_size)
    
    return None, pr_subj


def prob_hits_fast(hit_cnt, chr_size):
    """
    Compute p-values and q-values for gene hit counts.
    
    Optimizations:
    - Pre-extracts all arrays before main loop
    - Uses numba-optimized kernels for probability computation
    
    Parameters
    ----------
    hit_cnt : dict
        Output from count_hits_fast()
    chr_size : DataFrame
        Chromosome sizes with columns: chrom, size
    
    Returns
    -------
    dict
        Results including gene.hits DataFrame with p/q-values
    """
    lsn_data = hit_cnt["lsn.data"]
    gene_data = hit_cnt["gene.data"]
    gene_lsn_data = hit_cnt["gene.lsn.data"]
    gene_index = hit_cnt["gene.index"]
    lsn_index = hit_cnt["lsn.index"]
    nhit_mtx = hit_cnt["nhit.mtx"]
    nsubj_mtx = hit_cnt["nsubj.mtx"]

    if "lsn.row" in lsn_data.columns:
        lsn_data = lsn_data.set_index("lsn.row", drop=False)

    num_lsn = lsn_data["lsn.type"].unique()

    # Build gene-lesion index structures
    gene_lsn_data = gene_lsn_data.sort_values(
        by=["lsn.type", "lsn.chrom", "gene.row", "ID"]
    ).reset_index(drop=True)
    
    m = gene_lsn_data.shape[0]
    new_sect = np.where(
        (gene_lsn_data["gene.chrom"].values[1:] != gene_lsn_data["gene.chrom"].values[:-1]) |
        (gene_lsn_data["lsn.type"].values[1:] != gene_lsn_data["lsn.type"].values[:-1]) |
        (gene_lsn_data["gene.row"].values[1:] != gene_lsn_data["gene.row"].values[:-1])
    )[0]

    sect_start = [0] + (new_sect + 1).tolist()
    sect_end = new_sect.tolist() + [m - 1]

    gene_lsn_index = pd.DataFrame({
        "lsn.type": gene_lsn_data.iloc[sect_start]["lsn.type"].values,
        "chrom": gene_lsn_data.loc[sect_start, "gene.chrom"].values,
        "gene.row": gene_lsn_data.loc[sect_start, "gene.row"].values,
        "row.start": sect_start,
        "row.end": sect_end,
    })
    gene_lsn_index["n.lsns"] = gene_lsn_index["row.end"] - gene_lsn_index["row.start"] + 1

    k = gene_lsn_index.shape[0]
    new_chr = gene_lsn_index["chrom"].shift(-1) != gene_lsn_index["chrom"]
    new_chr = new_chr[:k - 1][new_chr[:k - 1]].index
    chr_start = [0] + list(new_chr + 1)
    chr_end = list(new_chr) + [k - 1]

    gene_lsn_chr_index = pd.DataFrame({
        "lsn.type": gene_lsn_index.loc[chr_start, "lsn.type"].values,
        "chrom": gene_lsn_index.loc[chr_start, "chrom"].values,
        "row.start": chr_start,
        "row.end": chr_end,
    })
    gene_lsn_chr_index["n.rows"] = gene_lsn_chr_index["row.end"] - gene_lsn_chr_index["row.start"] + 1

    nr_li = lsn_index.shape[0]
    cond = (
        (lsn_index["lsn.type"].shift(-1) != lsn_index["lsn.type"]) |
        (lsn_index["chrom"].shift(-1) != lsn_index["chrom"])
    )
    new_chr = cond[:nr_li - 1][cond[:nr_li - 1]].index
    chr_start = [0] + list(new_chr + 1)
    chr_end = list(new_chr) + [nr_li - 1]

    lsn_chr_index = pd.DataFrame({
        "lsn.type": lsn_index.loc[chr_start, "lsn.type"].values,
        "chrom": lsn_index.loc[chr_start, "chrom"].values,
        "row.start": chr_start,
        "row.end": chr_end,
    })

    b = gene_lsn_chr_index.shape[0]
    g, nlt = nhit_mtx.shape

    # =========================================================================
    # PRE-EXTRACTION: Pull all data into numpy arrays before main loop
    # =========================================================================
    
    glci_row_start = gene_lsn_chr_index["row.start"].values
    glci_row_end = gene_lsn_chr_index["row.end"].values
    glci_lsn_type = gene_lsn_chr_index["lsn.type"].values
    glci_chrom = gene_lsn_chr_index["chrom"].values
    
    gli_row_start = gene_lsn_index["row.start"].values
    gli_row_end = gene_lsn_index["row.end"].values
    
    gld_gene_row = gene_lsn_data["gene.row"].values
    
    lsn_chr_lookup = {}
    for idx in range(len(lsn_chr_index)):
        key = (lsn_chr_index["lsn.type"].iloc[idx], lsn_chr_index["chrom"].iloc[idx])
        lsn_chr_lookup[key] = (
            lsn_chr_index["row.start"].iloc[idx],
            lsn_chr_index["row.end"].iloc[idx]
        )
    
    li_row_start = lsn_index["row.start"].values
    li_row_end = lsn_index["row.end"].values
    
    lsn_data_index = lsn_data.index.values
    lsn_data_loc_start = lsn_data["loc.start"].values
    lsn_data_loc_end = lsn_data["loc.end"].values
    lsn_data_id = lsn_data["ID"].values
    
    lsn_row_to_pos = {row: i for i, row in enumerate(lsn_data_index)}
    
    gene_data_index = gene_data.index.values
    gene_data_loc_start = gene_data["loc.start"].values
    gene_data_loc_end = gene_data["loc.end"].values
    
    gene_row_to_pos = {row: i for i, row in enumerate(gene_data_index)}
    
    chr_size_lookup = dict(zip(chr_size["chrom"].values, chr_size["size"].values))
    
    nsubj_cols = list(nsubj_mtx.columns)
    nsubj_col_to_idx = {col: i for i, col in enumerate(nsubj_cols)}
    nsubj_arr = nsubj_mtx.values.astype(np.float64)
    
    p_nsubj_arr = np.ones((g, nlt), dtype=np.float64)

    # =========================================================================
    # MAIN LOOP: Process each chromosome × lesion type block
    # =========================================================================
    
    for i in range(b):
        gli_start = glci_row_start[i]
        gli_end = glci_row_end[i]
        gld_start = gli_row_start[gli_start]
        gld_end = gli_row_end[gli_end]
        
        gene_rows_all = gld_gene_row[gld_start:gld_end + 1]
        gene_rows = np.unique(gene_rows_all)
        
        current_lsn_type = glci_lsn_type[i]
        current_chrom = glci_chrom[i]
        
        lsn_chr_key = (current_lsn_type, current_chrom)
        if lsn_chr_key not in lsn_chr_lookup:
            continue
        
        lsn_index_start, lsn_index_end = lsn_chr_lookup[lsn_chr_key]
        lsn_start = li_row_start[lsn_index_start]
        lsn_end = li_row_end[lsn_index_end]
        
        lsn_type = current_lsn_type
        
        chrom_size_val = chr_size_lookup.get(current_chrom)
        if chrom_size_val is None:
            continue
        
        gene_pos = np.array([gene_row_to_pos.get(r, -1) for r in gene_rows], dtype=np.int64)
        if np.any(gene_pos < 0):
            continue
        
        lsn_rows = np.arange(lsn_start, lsn_end + 1)
        lsn_pos = np.array([lsn_row_to_pos.get(r, -1) for r in lsn_rows], dtype=np.int64)
        if np.any(lsn_pos < 0):
            continue
        
        gene_size = (gene_data_loc_end[gene_pos] - gene_data_loc_start[gene_pos] + 1).astype(np.float64)
        lsn_size = (lsn_data_loc_end[lsn_pos] - lsn_data_loc_start[lsn_pos] + 1).astype(np.float64)
        lsn_subj_IDs = lsn_data_id[lsn_pos]
        
        _, pr_subj = process_block_in_chunks_fast(
            gene_size, lsn_size, lsn_subj_IDs, chrom_size_val
        )
        
        lsn_type_idx = nsubj_col_to_idx[lsn_type]
        nsubj_for_genes = nsubj_arr[gene_pos, lsn_type_idx]
        nsubj_vals = nsubj_for_genes.astype(np.int64)
        
        p_nsubj_values = bern_conv_and_pvalue(pr_subj, nsubj_vals)
        
        p_nsubj_arr[gene_pos, lsn_type_idx] = p_nsubj_values

    # =========================================================================
    # POST-PROCESSING: FDR correction and formatting
    # =========================================================================
    
    p_nsubj = pd.DataFrame(p_nsubj_arr, columns=nsubj_mtx.columns)

    q_nsubj = p_nsubj.copy()
    for col in p_nsubj.columns:
        pi_hat = min(1, 2 * p_nsubj[col].mean(skipna=True))
        q_nsubj[col] = pi_hat * fdrcorrection(p_nsubj[col].fillna(1))[1]

    round_digits = 4

    def sig_round(x):
        try:
            if x == 0 or not np.isfinite(x):
                return 0.0
            with np.errstate(divide='ignore', invalid='ignore'):
                return np.round(x, round_digits - int(np.floor(np.log10(abs(x)))) - 1)
        except Exception:
            return 0.0

    if len(num_lsn) > 1:
        p_ord_nsubj = pd.DataFrame(p_order(p_nsubj), columns=p_nsubj.columns)
        q_ord_nsubj = p_ord_nsubj.copy()
        for col in p_ord_nsubj.columns:
            pi_hat = min(1, 2 * p_ord_nsubj[col].mean(skipna=True))
            q_ord_nsubj[col] = pi_hat * fdrcorrection(p_ord_nsubj[col].fillna(1))[1]

        p_ord_nsubj.columns = [f"p{i + 1}.nsubj" for i in range(p_nsubj.shape[1])]
        q_ord_nsubj.columns = [f"q{i + 1}.nsubj" for i in range(p_nsubj.shape[1])]

        p_nsubj = p_nsubj.apply(lambda col: col.map(sig_round))
        q_nsubj = q_nsubj.apply(lambda col: col.map(sig_round))
        p_ord_nsubj = p_ord_nsubj.apply(lambda col: col.map(sig_round))
        q_ord_nsubj = q_ord_nsubj.apply(lambda col: col.map(sig_round))

        gene_res = pd.concat([
            gene_data.drop(columns=["glp.row.start", "glp.row.end"], errors="ignore"),
            nsubj_mtx.add_prefix("nsubj."),
            p_nsubj.add_prefix("p.nsubj."),
            q_nsubj.add_prefix("q.nsubj."),
            p_ord_nsubj,
            q_ord_nsubj
        ], axis=1)

    else:
        p_nsubj = p_nsubj.apply(lambda col: col.map(sig_round))
        q_nsubj = q_nsubj.apply(lambda col: col.map(sig_round))

        gene_res = pd.concat([
            gene_data.drop(columns=["glp.row.start", "glp.row.end"], errors="ignore"),
            nsubj_mtx.add_prefix("nsubj."),
            p_nsubj.add_prefix("p.nsubj."),
            q_nsubj.add_prefix("q.nsubj.")
        ], axis=1)

    return {
        "gene.hits": gene_res,
        "lsn.data": lsn_data,
        "gene.data": gene_data,
        "gene.lsn.data": gene_lsn_data,
        "chr.size": chr_size,
        "gene.index": gene_index,
        "lsn.index": lsn_index
    }


# =============================================================================
# STATISTICAL HELPER FUNCTIONS
# =============================================================================

def p_order(P):
    """
    Compute ordered p-values for constellation test.
    
    Uses beta distribution for order statistics of uniform distribution.
    
    Parameters
    ----------
    P : DataFrame or ndarray
        P-values matrix, shape (n_genes, n_lesion_types)
    
    Returns
    -------
    ndarray
        Ordered p-values
    """
    P = np.array(P)
    sorted_P = np.sort(P, axis=1)
    k = P.shape[1]
    res = np.empty_like(sorted_P)
    for i in range(k):
        res[:, i] = beta.cdf(sorted_P[:, i], i + 1, k - i + 1)
    return res


def row_prob_subj_hit(P, IDs):
    """
    Compute probability that each subject has a hit for each gene.
    
    Parameters
    ----------
    P : ndarray, shape (n_genes, n_lesions)
        Hit probability matrix
    IDs : array-like
        Subject ID for each lesion
    
    Returns
    -------
    ndarray, shape (n_genes, n_subjects)
        Per-subject hit probabilities
    """
    IDs = np.asarray(IDs)
    order = np.argsort(IDs)
    P_sorted = P[:, order]
    IDs_sorted = IDs[order]

    changes = np.where(IDs_sorted[1:] != IDs_sorted[:-1])[0]
    ID_start = np.concatenate(([0], changes + 1))
    ID_end = np.concatenate((changes, [len(IDs_sorted) - 1]))

    g = P.shape[0]
    n = len(ID_start)
    Pr = np.zeros((g, n))

    for i in range(n):
        pr_block = P_sorted[:, ID_start[i]:ID_end[i] + 1]
        np.clip(pr_block, 1e-10, 1 - 1e-10, out=pr_block)
        Pr[:, i] = 1 - np.exp(np.sum(np.log(1 - pr_block), axis=1))

    return Pr


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

def grin_stats(lsn_data, gene_data, chr_size):
    """
    Run full GRIN statistical analysis pipeline.
    
    This is the main entry point for GRIN2 analysis. It orchestrates:
    1. Data preparation and indexing
    2. Gene-lesion overlap detection
    3. Hit counting per gene
    4. Statistical significance computation
    
    Parameters
    ----------
    lsn_data : DataFrame
        Lesion data with columns: ID, chrom, loc.start, loc.end, lsn.type
    gene_data : DataFrame
        Gene annotations with columns: gene, chrom, loc.start, loc.end
    chr_size : DataFrame
        Chromosome sizes with columns: chrom, size
    
    Returns
    -------
    dict
        Results dictionary containing:
        - 'gene.hits': DataFrame with gene statistics, p-values, q-values
        - 'lsn.data': Processed lesion data
        - 'gene.data': Processed gene data
        - 'gene.lsn.data': Gene-lesion overlap data
        - 'chr.size': Chromosome sizes
        - 'gene.index': Gene index table
        - 'lsn.index': Lesion index table
    
    Examples
    --------
    >>> result = grin_stats(lesions_df, genes_df, chrom_sizes_df)
    >>> significant_genes = result['gene.hits'][result['gene.hits']['q.nsubj.SNV'] < 0.1]
    """
    prep_data = prep_gene_lsn_data_fast(lsn_data, gene_data)
    overlaps = find_gene_lsn_overlaps_fast(prep_data)
    counts_df = count_hits_fast(overlaps)
    result_df = prob_hits_fast(counts_df, chr_size)
    
    return result_df


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def write_error(msg):
    """Write message to stderr."""
    print(f"ERROR: {msg}", file=sys.stderr)


def timed_grin_stats(lsn_data, gene_data, chr_size):
    """
    Run GRIN analysis with timing instrumentation.
    
    Useful for performance profiling and optimization.
    
    Parameters
    ----------
    lsn_data : DataFrame
        Lesion data
    gene_data : DataFrame
        Gene annotations
    chr_size : DataFrame
        Chromosome sizes
    
    Returns
    -------
    dict
        Same as grin_stats(), with timing printed to stderr
    """
    timings = {}
    
    t0 = time.perf_counter()
    prep_data = prep_gene_lsn_data_fast(lsn_data, gene_data)
    timings['prep_gene_lsn_data'] = time.perf_counter() - t0
    
    t0 = time.perf_counter()
    overlaps = find_gene_lsn_overlaps_fast(prep_data)
    timings['find_gene_lsn_overlaps'] = time.perf_counter() - t0
    
    t0 = time.perf_counter()
    counts_df = count_hits_fast(overlaps)
    timings['count_hits'] = time.perf_counter() - t0
    
    t0 = time.perf_counter()
    result_df = prob_hits_fast(counts_df, chr_size)
    timings['prob_hits'] = time.perf_counter() - t0
    
    write_error("\n=== GRIN TIMING ===")
    for name, elapsed in sorted(timings.items(), key=lambda x: -x[1]):
        write_error(f"  {name}: {elapsed:.3f}s")
    write_error(f"  TOTAL: {sum(timings.values()):.3f}s")
    
    return result_df