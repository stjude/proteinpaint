import argparse
import json
from pathlib import Path
import time
import subprocess
import h5py
import numpy as np
import pandas as pd


# This script selects the top most variant genes by calculating the variance/interquartile region for each gene across samples.

# Various JSON parameters:
#    samples: Enter the sample ID(s) separated by comma
#    input_file: Path to input file (HDF5 format)
#    filter_extreme_values: boolean (true/false). When true, this filter according to logic filterbyExpr in edgeR. This basically removes genes that have very low gene counts.
#    num_genes: The top num_genes (for e.g 10) that need to be reported in the output.
#    rank_type: var/iqr . This parameter decides whether to sort genes using variance or interquartile region. There is an article which states that its better to use interquartile region than variance for selecting genes for clustering https://www.frontiersin.org/articles/10.3389/fgene.2021.632620/full
#    newformat?: bool. Used to support new format HDF5

# json_example='{"samples":"sample1,sample2,sample3","min_count":30,"min_total_count":20,"input_file":"/path/to/input/file.h5",
# "filter_extreme_values":true,"num_genes":100, "rank_type":"var"}'

def generate_sample_list(filename: str) -> np.ndarray:
    with h5py.File(filename, "r") as hdf_data:
        all_samples = hdf_data["samples"].asstr()[:]
        return all_samples[: int(0.8 * len(all_samples))]


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
    return df[sample_list]


def calculate_variance(
    input_matrix: pd.DataFrame,
    filter_extreme_values: bool,
    rank_type: str,
    desired_num_genes: int = 100,
) -> list[str]:
    # Minimum required percentage of samples after dropout from low expression and nan values
    MIN_PROP = 0.7
    sample_size_cutoff = MIN_PROP * len(input_matrix.columns)

    # TODO: arbitrarily using 5% to cutout low-expressed genes — may re-evaluate
    cutoffs = (input_matrix.quantile(0.05, axis=1)) if filter_extreme_values else pd.Series(0.0, index=input_matrix.index)
    #Finding genes that have enough samples with expression values above the cutoff and high enough expression
    valid_genes = input_matrix.ge(cutoffs, axis=0).sum(axis=1) >= sample_size_cutoff
    filtered_matrix = input_matrix.loc[valid_genes]

    if rank_type == "var":
        scores = filtered_matrix.var(axis=1)
    else:
        fq1 = filtered_matrix.quantile(0.25, axis=1)
        fq3 = filtered_matrix.quantile(0.75, axis=1)
        scores = fq3 - fq1

    scores = scores[scores >= 0].dropna()
    return scores.nlargest(desired_num_genes).index.tolist()

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Select top variant genes using variance or interquartile range from an HDF5 matrix."
        )
    )
    parser.add_argument(
        "json",
        nargs="?",
        help=(
            "JSON string containing samples, input_file, filter_extreme_values, num_genes, "
            "and rank_type"
        ),
    )
    parser.add_argument(
        "--params",
        dest="params",
        help=(
            "JSON string containing samples, input_file, filter_extreme_values, num_genes, "
            "and rank_type"
        ),
    )
    return parser.parse_args()


def main() -> int:
    performance_start = time.time()

    args = _parse_args()
    params_str = args.params or args.json
    if not params_str:
        print("Error: provide a JSON payload as positional argument or with --params")
        return 2

    try:
        json_args = json.loads(params_str)
        if not isinstance(json_args, dict):
            raise ValueError("Input JSON must be an object")

        samples_value = json_args.get("samples")
        if isinstance(samples_value, str):
            samples = [sample.strip() for sample in samples_value.split(",") if sample.strip()]
            # samples= generate_sample_list("/Users/jsimps98/data/tp/files/hg38/ash/transcriptomics/ash.hg38.fpkm.matrix6.h5")
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

        num_genes = json_args.get("num_genes")
        if not isinstance(num_genes, int) or num_genes < 1:
            raise ValueError("num_genes must be a positive integer")

        rank_type = json_args.get("rank_type")
        if rank_type not in ["iqr", "var"]:
            raise ValueError('rank_type must be either "iqr" or "var"')

        gene_sample_matrix = input_data_hdf5(input_file, samples)
        if gene_sample_matrix is None:
            raise ValueError("Could not load input matrix from HDF5")

        result = calculate_variance(gene_sample_matrix, filter_extreme_values, rank_type, num_genes)
        performance_end = time.time()

        print('python', json.dumps(result), performance_end-performance_start)
        # payload = {"input_file":"/Users/jsimps98/data/tp/files/hg38/ash/transcriptomics/ash.hg38.fpkm.matrix6.h5","filter_extreme_values":True,"num_genes":4, "rank_type":"var","samples":','.join(samples)}
        # performance_start = time.time()
        # result =subprocess.run(
        #         ["./target/release/topGeneByExpressionVariance"],
        #         input=json.dumps(payload),   # what echo was sending
        #         text=True,                   # send/receive str instead of bytes
        #         capture_output=True,
        #         check=True,
        #         cwd="/Users/jsimps98/dev/sjpp/proteinpaint/rust",  # optional
        #     )
        # performance_end = time.time()
        # print('rust',result.stdout, performance_end-performance_start)
        return 0
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
