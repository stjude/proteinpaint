import json
import os
from pathlib import Path
import sys
import h5py
import heapq
import numpy as np
import pandas as pd
import psutil


# This script selects the top most variant genes by calculating the variance/interquartile region for each gene across samples.
# Various JSON parameters:
#    samples: Enter the sample ID(s) separated by comma, must contain at least 10 samples
#    input_file: Path to input file (HDF5 format)
#    filter_extreme_values: boolean (true/false). When true, this filter removes genes that have very low expression in most samples, which can be considered as noise and can interfere with the variance calculation.
#    max_genes: The max num of genes between 1 and 1000 that need to be reported in the output.
#    rank_type: var/iqr . This parameter decides whether to sort genes using variance or interquartile region. There is an article which states that its better to use interquartile region than variance for selecting genes for clustering https://www.frontiersin.org/articles/10.3389/fgene.2021.632620/full

# echo '{"samples":"2646,2660,2898,3150,3178,3206,3220,3346,3360,1,3,7,21,22,23,37,38,39","input_file":"server/test/tp/files/hg38/TermdbTest/rnaseq/TermdbTest.fpkm.matrix.new.h5", "filter_extreme_values":true,"max_genes":10, "rank_type":"var"}' | python python/src/topVEgene.py

def get_memory_mb():
    """Return current process memory usage in MB."""
    try:
        return round(psutil.Process(os.getpid()).memory_info().rss / (1024 * 1024), 2)
    except Exception as e:
         print(f"Failed to get memory usage: {e}")

def generate_test_samples(percent_of_total:float,filename:str):
    with h5py.File(filename, "r") as hdf_data:
        all_samples = hdf_data["samples"].asstr()[:]
        return set(all_samples[:int(len(all_samples)*percent_of_total)])

def create_gene_variance_list(
    filename: str,
    sample_list: set[str],
    filter_extreme_values: bool,
    rank_type: str,
    max_genes: int
) -> list[str]:
    chunk_target_elements = 500_000
    with h5py.File(filename, "r") as hdf_data:
        gene_names = hdf_data["item"].asstr()[:]
        all_samples = hdf_data["samples"].asstr()[:]
        matrix = hdf_data["matrix"]
        
        n_genes, n_samples = len(gene_names), len(all_samples)
        if matrix.ndim != 2:
            raise ValueError("Expected 2D matrix for expression matrix")
        if matrix.shape[0] != n_genes:
            raise ValueError(f"Matrix rows ({matrix.shape[0]}) must equal number of genes ({n_genes})")
        if matrix.shape[1] != n_samples:
            raise ValueError(f"Matrix columns ({matrix.shape[1]}) must equal number of samples ({n_samples})")

        sample_to_idx = {sample: idx for idx, sample in enumerate(all_samples)}
        missing = sample_list - set(sample_to_idx)
        if missing:
            raise ValueError(f"Sample(s) {missing} not found in HDF5 file")
        sample_indexes = sorted(sample_to_idx[sample] for sample in sample_list)
        rows_per_chunk = max(1,chunk_target_elements // len(sample_indexes))
        selected_genes = []
        for start in range(0, matrix.shape[0], rows_per_chunk):
            stop = min(start + rows_per_chunk, matrix.shape[0])
            chunk = np.asarray(matrix[start:stop, sample_indexes], dtype=float)
            chunk_df = pd.DataFrame(chunk, index=gene_names[start:stop])
            selected_genes.extend(calculate_variance(chunk_df, filter_extreme_values, rank_type, len(sample_list)))
            if len(selected_genes) > 1000:
                selected_genes = heapq.nlargest(max_genes, selected_genes, key=lambda x: x[0])
        return [gene for _, gene in heapq.nlargest(max_genes, selected_genes, key=lambda x: x[0])]

def calculate_variance(
    expression_values: pd.DataFrame,
    filter_extreme_values: bool,
    rank_type: str,
    original_sample_size: int
) -> list[tuple[float | None, str]]:
    # Minimum proportion of samples that must have expression above the cutoff for the gene to be considered valid
    MIN_PROP = 0.7
    expression_cutoff = expression_values.quantile(0.1,numeric_only=True,axis=1) if filter_extreme_values else pd.Series([0]*expression_values.shape[0], index=expression_values.index)
    masked_matrix=expression_values.mask(expression_values.le(expression_cutoff, axis=0), other=np.nan)
    gene_sample_count = masked_matrix.gt(expression_cutoff,axis=0).sum(axis=1)
    min_sample_size = MIN_PROP * original_sample_size
    valid_genes = gene_sample_count >= min_sample_size

    filtered_matrix:pd.DataFrame = masked_matrix[valid_genes]
    if filtered_matrix.empty:
        return []
    if rank_type == "var":
        scores = filtered_matrix.var(axis=1, numeric_only=True)
    elif rank_type == "iqr":
        q1= filtered_matrix.quantile(0.25,numeric_only=True,axis=1)
        q3= filtered_matrix.quantile(0.75,numeric_only=True,axis=1)
        scores = q3 - q1
    else:
        raise ValueError('rank_type must be either "iqr" or "var"')

    return [(score, gene_name) for gene_name, score in scores.items() if pd.notna(score)]


def _read_stdin_payload() -> str:
    payload = sys.stdin.read().strip()
    if not payload:
        raise ValueError("No JSON payload provided on stdin")
    return payload

def main() -> int:
    try:
        params_str = _read_stdin_payload()
        json_args = json.loads(params_str)
        if not isinstance(json_args, dict):
            raise ValueError("Input JSON must be an object")

        samples_value = json_args.get("samples")
        if isinstance(samples_value, str):
            samples = set(sample.strip() for sample in samples_value.split(",") if sample.strip())
        elif isinstance(samples_value, list):
            samples_value = set(samples_value)
            samples = set(str(sample).strip() for sample in samples_value if str(sample).strip())
        else:
            raise ValueError("samples must be a comma-separated string or a JSON list")
        MIN_SAMPLES = 10
        if len(samples) < MIN_SAMPLES:
            raise ValueError(f"samples must include at least {MIN_SAMPLES} sample IDs")
        if json_args.get('test'):
            samples = generate_test_samples(0.5,json_args.get("input_file"))

        input_file = json_args.get("input_file")
        if not isinstance(input_file, str):
            raise ValueError("input_file must be a string path")
        if not Path(input_file).is_file():
            raise FileNotFoundError(f"{input_file} could not be found")
        if not h5py.is_hdf5(input_file):
            raise ValueError(f"{input_file} is not a valid hdf5")

        filter_extreme_values = json_args.get("filter_extreme_values")
        if not isinstance(filter_extreme_values, bool):
            raise ValueError("filter_extreme_values must be true or false")

        max_genes = json_args.get("max_genes")
        if not isinstance(max_genes, int) or max_genes < 1 or max_genes > 1000:
            raise ValueError(f"max_genes must be an integer between 1 and 1000")

        rank_type = json_args.get("rank_type")
        if rank_type not in ["iqr", "var"]:
            raise ValueError('rank_type must be either "iqr" or "var"')
        result = create_gene_variance_list(input_file, samples, filter_extreme_values, rank_type, max_genes)
        if not result:
            raise ValueError("No genes passed the filtering criteria")
        print(json.dumps(result))
        return 0
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

