import argparse
import json
import h5py, sys
import numpy as np
import pandas as pd
from pathlib import Path


# This script selects the top most variant genes by calculating the variance/interquartile region for each gene across samples.

# Various JSON parameters:
#    samples: Enter the sample ID(s) separated by comma
#    input_file: Path to input file (HDF5 format)
#    filter_extreme_values: boolean (true/false). When true, this filter according to logic filterbyExpr in edgeR. This basically removes genes that have very low gene counts.
#    num_genes: The top num_genes (for e.g 10) that need to be reported in the output.
#    rank_type: var/iqr . This parameter decides whether to sort genes using variance or interquartile region. There is an article which states that its better to use interquartile region than variance for selecting genes for clustering https://www.frontiersin.org/articles/10.3389/fgene.2021.632620/full
#    newformat?: bool. Used to support new format HDF5

#python genevariance.py '{"input_file":"~/data/tp/files/hg38/TermdbTest/rnaseq/TermdbTest.fpkm.matrix.new.h5","filter_extreme_values":true,
# "num_genes":100, "rank_type":"var","samples":"2646,2660,2898,3150,3178,3206,3220,3346,3360,1,3,7,21,22,23,37,38,39"}'

def generate_sample_list(filename:str):
    with h5py.File(filename, 'r') as hdf_data:
        all_samples=hdf_data['samples'].asstr()[:]
        sample_len=all_samples.__len__()
        return all_samples[:int(0.1*sample_len)]
    
def input_data_hdf5(filename:str, sample_list: list):
    try:
        with h5py.File(filename, 'r') as hdf_data:
            
            if not all(isinstance(item, str) for item in sample_list):
                try:
                    sample_list=[str(sample) for sample in sample_list]
                except Exception as e:
                    print(e)
                    raise ValueError("Couldn't convert sample list to string. " \
                    "Make sure elements are string or number types")

            # Read gene symbols dataset
            gene_names = hdf_data['item'].asstr()[:]
            num_genes=gene_names.__len__()

            # Read sample names
            all_samples=hdf_data['samples'].asstr()[:]
            sample_len=all_samples.__len__()
            np.set_printoptions(threshold=sys.maxsize)
            # Creating counts DF where genes are the rows and samples are the columns
            df = pd.DataFrame(np.array(hdf_data['matrix']))
        # Validating dimensions
        matrix_shape=df.shape
        if matrix_shape.__len__()!=2:
            raise ValueError("Expected 2D matrix for expression matrix")
        if matrix_shape[0]!=num_genes:
            raise ValueError(f"Matrix rows ({matrix_shape[0]}) must equal number of genes ({num_genes})")
        if matrix_shape[1]!=sample_len:
            raise ValueError(f"Matrix columns ({matrix_shape[1]}) must equal number of samples ({sample_len})")
        df.index=gene_names
        df.columns=all_samples
        return df[sample_list]
    except Exception as e:
        print(e)


def calculate_variance(
    input_matrix: pd.DataFrame,
    filter_extreme_values: bool,
    rank_type: str,
    desired_num_genes:int=100
):
    #Minimum required percentage of samples after dropout from low expression and nan values, might make this a parameter instead of hardcoded
    MIN_PROP: float = 0.7; 
    sample_size_cutoff:float=MIN_PROP*input_matrix.columns.__len__()
    gene_data:dict[str,float]={}

    for gene_name, row_data in input_matrix.iterrows():
        count_value_cutoff=0
        # TODO Gonna arbitrarily use Tukeys Rule to find low expressed genes, might re-evaluate
        Q1, Q3 = row_data.quantile([0.25, 0.75])
        iqr=Q3-Q1
        
        if filter_extreme_values:
            count_value_cutoff:float= Q1-1.5*iqr
        sample_size: int = (row_data>=count_value_cutoff).sum()
        if sample_size<sample_size_cutoff: continue

        row_data=row_data[row_data>=count_value_cutoff]
        if rank_type == "var":
            variance:float =row_data.var()
            if variance: gene_data[gene_name]=variance
        else:
            Q1, Q3 = row_data.quantile([0.25, 0.75])
            iqr=Q3-Q1
            if iqr: gene_data[gene_name]=iqr
    return [key for (key,_) in sorted(gene_data.items(), key=lambda item: item[1],reverse=True)[:desired_num_genes]]

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
    args = _parse_args()
    params_str = getattr(args, "params", None) or args.json
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
        print(json.dumps(result))
        return 0
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())