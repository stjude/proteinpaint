import json
from pathlib import Path
import sys
import h5py
import heapq
import numpy as np


# This script selects the top most variant genes by calculating the variance/interquartile region for each gene across samples.

# Various JSON parameters:
#    samples: Enter the sample ID(s) separated by comma
#    input_file: Path to input file (HDF5 format)
#    filter_extreme_values: boolean (true/false). When true, this filter removes genes that have very low expression in most samples, which can be considered as noise and can interfere with the variance calculation.
#    max_genes: The max num of genes between 10 and 1000 that need to be reported in the output.
#    rank_type: var/iqr . This parameter decides whether to sort genes using variance or interquartile region. There is an article which states that its better to use interquartile region than variance for selecting genes for clustering https://www.frontiersin.org/articles/10.3389/fgene.2021.632620/full

# echo '{"samples":"2646,2660,2898,3150,3178,3206,3220,3346,3360,1,3,7,21,22,23,37,38,39","input_file":"server/test/tp/files/hg38/TermdbTest/rnaseq/TermdbTest.fpkm.matrix.new.h5", "filter_extreme_values":true,"max_genes":10, "rank_type":"var"}' | python python/src/topVEgene.py

def create_gene_variance_list(
    filename: str,
    sample_list: list,
    filter_extreme_values: bool,
    rank_type: str,
    max_genes: int
) -> list[str]:
    sample_list = [str(s) for s in sample_list]
    with h5py.File(filename, "r") as hdf_data:
        gene_names = hdf_data["item"].asstr()[:]
        all_samples = hdf_data["samples"].asstr()[:]
        matrix = hdf_data["matrix"]

        sample_indexes = [index for index, sample in enumerate(all_samples) if sample in sample_list]
        if len(sample_indexes) < len(sample_list):
            missing=set(sample_list) - set(all_samples)
            raise ValueError(f"Sample(s) {set(missing)} not found in HDF5 file")


        selected_genes = []
        for i in range(matrix.shape[0]):
            expression_values = np.asarray(matrix[i, sample_indexes], dtype=float)
            gene_info: tuple[float | None,str ] = calculate_variance_fast(
                gene_names[i], expression_values, filter_extreme_values, rank_type, len(sample_list)
            )

            if isinstance(gene_info[0], float | int):
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
    cutoff = float(np.quantile(expression_values, 0.1)) if filter_extreme_values else 0.0
    gene_sample_count = int(np.sum(expression_values >= cutoff))
    min_sample_size = MIN_PROP * original_sample_size

    if gene_sample_count < min_sample_size:
        return (None, gene_name)

    if rank_type == "var":
        score = float(np.var(expression_values))
    elif rank_type == "iqr":
        q1, q3 = np.quantile(expression_values, [0.25, 0.75])
        score = float(q3 - q1)
    else:
        raise ValueError('rank_type must be either "iqr" or "var"')

    return (score, gene_name)


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
        if not isinstance(max_genes, int) or max_genes < 10 or max_genes > 1000:
            raise ValueError("max_genes must be an integer between 10 and 1000")

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
