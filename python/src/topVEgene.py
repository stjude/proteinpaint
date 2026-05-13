import json
import os
from pathlib import Path
import sys
import h5py
import heapq
import numpy as np
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
        selected_genes = []

        for i in range(matrix.shape[0]):
            expression_values = np.asarray(matrix[i, sample_indexes], dtype=float)
            gene_info: tuple[float | None,str ] = calculate_variance_fast(
                gene_names[i], expression_values, filter_extreme_values, rank_type, len(sample_list)
            )

            if isinstance(gene_info[0], float | int) and np.isfinite(gene_info[0]):
                heapq.heappush(selected_genes, gene_info)
                if len(selected_genes) > max_genes:
                    heapq.heappop(selected_genes)
        top_genes = heapq.nlargest(max_genes, selected_genes, key=lambda x: x[0])
        return [gene for _, gene in top_genes]

def calculate_variance_fast(
    gene_name: str,
    expression_values: np.ndarray,
    filter_extreme_values: bool,
    rank_type: str,
    original_sample_size: int
) -> tuple[float | None,str ]:
    # Minimum proportion of samples that must have expression above the cutoff for the gene to be considered valid
    MIN_PROP = 0.7
    filter_nan = expression_values[(np.isfinite(expression_values)) & (expression_values > 0)]
    if filter_nan.size == 0:
        return (None, gene_name)

    if filter_extreme_values:
        cutoff = float(np.quantile(filter_nan, 0.1))
        filtered_row = filter_nan[filter_nan >= cutoff]
    else:
        filtered_row = filter_nan

    gene_sample_count = filtered_row.size
    min_sample_size = MIN_PROP * original_sample_size
    if gene_sample_count < min_sample_size:
        return (None, gene_name)

    if rank_type == "var":
        #ddof for sample variance
        score = float(np.var(filtered_row, ddof=1))
    elif rank_type == "iqr":
        q1, q3 = np.quantile(filtered_row, [0.25, 0.75])
        score = float(q3 - q1)
    else:
        raise ValueError('rank_type must be either "iqr" or "var"')

    return (score, gene_name)


def _read_stdin_payload() -> str:
    payload = sys.stdin.read().strip()
    # ash_test_file = "/Users/jsimps98/data/tp/files/hg38/ash/transcriptomics/ash.hg38.fpkm.matrix7.h5"
    # payload = json.dumps({
    #     "samples": sorted(generate_test_samples(1, ash_test_file)),
    #     "input_file": ash_test_file,
    #     "filter_extreme_values": True,
    #     "max_genes": 10,
    #     "rank_type": "var"
    # })
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

