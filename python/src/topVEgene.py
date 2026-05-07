import json
from pathlib import Path
import sys
import h5py
import numpy as np
import pandas as pd


# This script selects the top most variant genes by calculating the variance/interquartile region for each gene across samples.

# Various JSON parameters:
#    samples: Enter the sample ID(s) separated by comma
#    input_file: Path to input file (HDF5 format)
#    filter_extreme_values: boolean (true/false). When true, this filter removes genes that have very low expression in most samples, which can be considered as noise and can interfere with the variance calculation.
#    max_genes: The max num of genes (for e.g 10) that need to be reported in the output.
#    rank_type: var/iqr . This parameter decides whether to sort genes using variance or interquartile region. There is an article which states that its better to use interquartile region than variance for selecting genes for clustering https://www.frontiersin.org/articles/10.3389/fgene.2021.632620/full

# echo '{"samples":"2646,2660,2898,3150,3178,3206,3220,3346,3360,1,3,7,21,22,23,37,38,39","input_file":"server/test/tp/files/hg38/TermdbTest/rnaseq/TermdbTest.fpkm.matrix.new.h5", "filter_extreme_values":true,"max_genes":10, "rank_type":"var"}' 
#  | /Users/jsimps98/anaconda3/envs/pp_env/bin/python python/src/topVEgene.py

def input_data_hdf5(filename: str, sample_list: list) -> pd.DataFrame:
    sample_list = [str(s) for s in sample_list]
    with h5py.File(filename, "r") as hdf_data:
        gene_names = hdf_data["item"].asstr()[:]
        all_samples = hdf_data["samples"].asstr()[:]
        matrix = np.array(hdf_data["matrix"])

    n_genes, n_samples = len(gene_names), len(all_samples)
    if matrix.ndim != 2:
        raise ValueError("Expected 2D matrix for expression matrix")
    if matrix.shape[0] != n_genes:
        raise ValueError(f"Matrix rows ({matrix.shape[0]}) must equal number of genes ({n_genes})")
    if matrix.shape[1] != n_samples:
        raise ValueError(f"Matrix columns ({matrix.shape[1]}) must equal number of samples ({n_samples})")

    df = pd.DataFrame(matrix, index=gene_names, columns=all_samples)
    if not set(sample_list).issubset(set(all_samples)):
        missing_samples = set(sample_list) - set(all_samples)
        raise ValueError(f"Sample(s) {missing_samples} not found in HDF5 file")
    return df[sample_list]


def calculate_variance(
    input_matrix: pd.DataFrame,
    filter_extreme_values: bool,
    rank_type: str,
    max_genes: int = 100,
) -> list[str]:
    #TODO stop at 1000 and change to max genes
    max_genes=np.clip(max_genes, 1, 1000)
    # Minimum required percentage of samples after dropout from low expression
    MIN_PROP = 0.7
    #using 10% based on https://pmc.ncbi.nlm.nih.gov/articles/PMC4983432/, other discussions/papers have suggested cutoff is mostly arbitrary
    cutoffs = (input_matrix.quantile(0.1, axis=1)) if filter_extreme_values else pd.Series(0.0, index=input_matrix.index)
    #Finding genes that have enough samples with expression values above the cutoff and high enough expression
    gene_sample_count = input_matrix.ge(cutoffs, axis=0).sum(axis=1)
    # Minimum sample size based on 70% of total samples
    min_sample_size = MIN_PROP * input_matrix.shape[1]
    valid_genes = gene_sample_count >= (min_sample_size)
    filtered_matrix = input_matrix.loc[valid_genes]

    if rank_type == "var":
        scores = filtered_matrix.var(axis=1)
    else:
        fq1 = filtered_matrix.quantile(0.25, axis=1)
        fq3 = filtered_matrix.quantile(0.75, axis=1)
        scores = fq3 - fq1

    scores = scores[scores >= 0].dropna()
    return scores.nlargest(max_genes).index.tolist()

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
            samples = [sample.strip() for sample in samples_value.split(",") if sample.strip()]
        elif isinstance(samples_value, list):
            samples = [str(sample).strip() for sample in samples_value if str(sample).strip()]
        else:
            raise ValueError("samples must be a comma-separated string or a JSON list")
        if len(samples) < 2:
            raise ValueError("samples must include at least 2 sample IDs")

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
            raise ValueError("max_genes must be an integer between 1 and 1000")

        rank_type = json_args.get("rank_type")
        if rank_type not in ["iqr", "var"]:
            raise ValueError('rank_type must be either "iqr" or "var"')

        gene_sample_matrix = input_data_hdf5(input_file, samples)
        if gene_sample_matrix is None:
            raise ValueError("Could not load input matrix from HDF5")

        result = calculate_variance(gene_sample_matrix, filter_extreme_values, rank_type, max_genes)
        print(json.dumps(result))
        return 0
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
