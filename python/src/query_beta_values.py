"""
    This script processes DNA methylation queries of two types 
    given a HDF5 file of DNA methylation beta matrix:

        Type 1: Provided a list of sample(s) and a genomic range, returns all the beta values
                for those samples in the specified genomic range.

                For e.g.:  samples: [a, b, c, d], genomic query range: chr2:23434-3434553
                    :  output: [[0.1, 0.3, 0.5, 0.2],
                               [...,...,...,...],
                               [...,...,...,...],
                                  ...
                               [...,...,...,...]]

        Type 2: Provided a list of sample(s) and a list of CpG id(s)
                
                For e.g.:  samples: [a, b, c, d], CpG ids: [cg12323423, cg34583234,...]

    Inputs: The script parses input first via standard input (stdin) and if no stdin found
            falls back on command line arguments.

            Stdin:
                When using stdin, a json input is expected. For e.g.:
                    1) echo '{h:"dnaMeth.h5", s:"a,b,c", q:"cg123,cg5343"}' | python query_beta_values.py
                    2) echo '{h:"dnaMeth.h5", validate:True}' | python query_beta_values.py
                
            Command Line Inputs:
                1. --h : path to the HDF5 file of DNA methylation values
                2. --s : sample(s)
                       : When directly running the script, sample names are separated by commas. For e.g.: "--s a,b,c,d"
                3. --q : Either genomic range query or CpG IDs
                       : When directly running the script, CpG ids are separated by commas. For e.g.: "--q cg1232,cg54324b"

                For e.g.:
                    1) python --h dnaMeth.h5 --s 1,3,2 --q cg123,cg5343
                    2) python --h dnaMeth.h5 --s 1,3,2 --q chr17:3434-5837403
                    3) python --h dnaMeth.h5 --validate 

    Output: Returns a 2-D matrix of dimension n_query_sites X n_query_samples where the input query sample order is preserved.
          : For genomic range query, n_query_sites will depend on the input query genomic range and if any values are present
            for the input range in the HDF5 file.

          Note: If the returned matrix has -1.0 for some samples, it means no methylation values were available for those samples.
"""

import h5py
import numpy as np
import os, re
import argparse
import json, sys

def validate_dnameth_hdf5(input_hdf5_file: str) -> list[str]:
    """
    Validate a DNA methylation HDF5 file with the expected structure:

        /beta/values             Dataset {n_sites, n_samples}
        /meta                    Group
        /meta/probe              Group
        /meta/probe/probeID      Dataset {n_sites}
        /meta/probe/row_idx      Dataset {n_sites}
        /meta/samples            Group
        /meta/samples/col_idx    Dataset {n_samples}
        /meta/samples/names      Dataset {n_samples}
        /meta/start              Dataset {n_sites}

    Returns:
        List[str]: sample names from /meta/samples/names
    """
    print("Validating the HDF structure...", flush=True)
    with h5py.File(input_hdf5_file, "r") as h5:
        required_datasets = [
            "/beta/values",
            "/meta/probe/probeID",
            "/meta/probe/row_idx",
            "/meta/samples/col_idx",
            "/meta/samples/names",
            "/meta/start",
        ]

        # Check existence 
        for path in required_datasets:
            if path not in h5:
                raise KeyError(f"Missing required dataset: '{path}'")

        # Load core datasets 
        beta = h5["/beta/values"]
        probe_ids = h5["/meta/probe/probeID"]
        row_idx = h5["/meta/probe/row_idx"]
        col_idx = h5["/meta/samples/col_idx"]
        sample_names_ds = h5["/meta/samples/names"].asstr()[:]
        starts = h5["/meta/start"]

        # Validate beta matrix 
        if beta.ndim != 2:
            raise ValueError(
                f"/beta/values must be 2 dimensional but has the shape: {beta.shape}"
            )

        n_sites, n_samples = beta.shape
        if n_sites == 0 or n_samples == 0:
            raise ValueError("Matrix dimensions must be > 0")

        # Validate row-aligned datasets 
        if probe_ids.shape[0] != n_sites:
            raise ValueError(
                f"probeID length ({probe_ids.shape[0]}) "
                f"!= number of sites ({n_sites})"
            )
        if row_idx.shape[0] != n_sites:
            raise ValueError(
                f"row_idx length ({row_idx.shape[0]}) "
                f"!= number of sites ({n_sites})"
            )
        if starts.shape[0] != n_sites:
            raise ValueError(
                f"start length ({starts.shape[0]}) "
                f"!= number of sites ({n_sites})"
            )

        # Validate column-aligned datasets 
        if col_idx.shape[0] != n_samples:
            raise ValueError(
                f"col_idx length ({col_idx.shape[0]}) "
                f"!= number of samples ({n_samples})"
            )
        if sample_names_ds.shape[0] != n_samples:
            raise ValueError(
                f"sample names length ({sample_names_ds.shape[0]}) "
                f"!= number of samples ({n_samples})"
            )

        # Sanity check: unique samples 
        sample_names = [str(s) for s in sample_names_ds]
        if len(set(sample_names)) != len(sample_names):
            raise ValueError("Duplicate sample names detected")
        return sample_names


class Query:
    def __init__(self, input_hdf5_file):
        self.h5file = input_hdf5_file

    @staticmethod
    def parse_genomic(query_string):
        """Parse genomic range query: chr17:100-200 or chr17:100"""
        pattern = r'^(chr(?:[1-9]|1[0-9]|2[0-2])|chrX|chrY|chrM):(\d+)(?:-(\d+))?$'
        match = re.match(pattern, query_string, re.IGNORECASE)

        if not match:
            raise ValueError(
                f"Invalid genomic range format: '{query_string}'. "
                f"Expected format: chr17:100-200 or chr17:100"
            )
        chrom = match.group(1)
        start = int(match.group(2))
        end = int(match.group(3)) if match.group(3) else start

        if start > end:
            raise ValueError(f"Start position ({start}) > end position ({end})")
        return {
            'type': 'genomic',
            'chrom': chrom,
            'start': start,
            'end': end
        }

    @staticmethod
    def parse_cpg(query_string):
        """Parse CpG query: cg12345,cg67890"""
        cpg_ids = [cpg.strip() for cpg in query_string.split(',')]

        # Validate CpG ID format (cg followed by digits)
        cpg_pattern = r'^cg\d+$'
        invalid = [cpg for cpg in cpg_ids if not re.match(cpg_pattern, cpg)]
        if invalid:
            raise ValueError(
                f"Invalid CpG ID(s): {invalid}. "
                f"Expected format: cg12345"
            )
        return {
            'type': 'cpg',
            'cpg_ids': cpg_ids
        }

    @staticmethod
    def auto_detect(query_string):
        """Auto-detect query type whether it is CpG-based or genomic range based and parse"""
        # Try genomic format first
        if ':' in query_string:
            try:
                return Query.parse_genomic(query_string)
            except ValueError:
                pass

        # Try CpG format
        if query_string.startswith('cg'):
            try:
                return Query.parse_cpg(query_string)
            except ValueError:
                pass

        raise ValueError(
            f"Could not parse query: '{query_string}'. "
            f"Expected formats:\n"
            f"  - Genomic: chr17:100-200 or chr17:100\n"
            f"  - CpG: cg12345,cg67890 or cg12345"
        )

    def group_by_chunks(self, chunk_ids):
        """
            chun_ids contains a sorted list of chunk_ids.
            Returns a list of lists where the sublists contain group boundaries
        """
        arr = np.array(chunk_ids)
        diff = np.diff(arr)
        split_indices = np.where(diff != 0)[0] + 1
        return split_indices

    def process_cpg_queries(self, query_samples, query_cpg_ids, verbose=False):
        try:
            h5 = h5py.File(self.h5file, "r")
        except Exception as e:
            fail(f"Failed to open HDF5 file: {e}")

        with h5:
            names = h5["meta/samples/names"].asstr()[:] #so that correctly decodes as string
            cols  = h5["meta/samples/col_idx"][:]
            sample_to_col = dict(zip(names, cols))

            probes = h5["meta/probe/probeID"].asstr()[:] #so that correctly decodes as string
            rows  = h5["meta/probe/row_idx"][:]
            probe_to_row = dict(zip(probes, rows))

            if verbose:
                print("######### In the H5 file provided ###########")
                print(f"Total # of samples: {len(names)}")
                print(f"Total # of CpG sites in {self.q_chrom}: {len(starts)}")
                print()
                print("######### Processing Queries ###########")
                print(f"Finding beta values in genomic range: [{starts[left]}, {starts[right-1]}]")
                print(f"# of beta values in the genomic range: {right - left}")
                print()
                print("####################")

            col_idx = [sample_to_col[s] for s in query_samples]
            row_idx = [probe_to_row[p] for p in query_cpg_ids]

            # preserve query order 
            row_order = sorted(range(len(row_idx)), key=lambda i: row_idx[i])
            col_order = sorted(range(len(col_idx)), key=lambda i: col_idx[i])

            # define dset and get row chunk
            dset = h5["beta/values"]
            row_chunk = dset.chunks[0]

            # sort the row indices and get chunk ids for the query rows
            sorted_row_idx = np.zeros(len(row_order), dtype=int)
            chunk_ids = np.zeros(len(row_order), dtype=int)
            for idx, i in enumerate(row_order):
                sorted_row_idx[idx] = row_idx[i]
                chunk_ids[idx] = row_idx[i] // row_chunk
            #sorted_row_idx = [row_idx[i] for i in row_order]
            sorted_col_idx = [col_idx[i] for i in col_order]

            # group the row indices by chunk ids 
            split_indices = self.group_by_chunks(chunk_ids)
            groups = np.split(sorted_row_idx, split_indices)
            repeated_row_groups = [list(g) for g in groups if len(g) >= 1]

            # Allocate result array
            result = np.empty((len(sorted_row_idx), len(sorted_col_idx)), dtype='float32')
            ## More efficient blocking method ###
            start = 0
            end = 0
            for gp in repeated_row_groups:
                end += len(gp)
                block_data = dset[gp, :]
                result[start:end, :] = block_data[:, sorted_col_idx]
                start = end
            ### Efficient blocking method end ###
                
            # restore original order
            inverse_row = [0] * len(row_order)
            inverse_col = [0] * len(col_order)
            for i, j in enumerate(row_order):
                inverse_row[j] = i
            for i, j in enumerate(col_order):
                inverse_col[j] = i
            query_beta = result[inverse_row,:][:,inverse_col]
        return query_beta

    def get_row_ranges_for_chrom(self, query_chrom, all_chromosomes, num_sites_pref_sum):
        """
           Find row range [start, end) in the beta matrix for query_chrom
        """
        q_idx = all_chromosomes.index(query_chrom)
        prev_idx = q_idx - 1 if q_idx > 0  else None
        row_start = num_sites_pref_sum[prev_idx + 1] if prev_idx is not None else 0
        row_end = num_sites_pref_sum[q_idx + 1] 
        return row_start, row_end

    def process_genomic_queries(self, query_samples, query_chrom, query_start, query_end, verbose=False):
        assert os.path.exists(self.h5file)
        try:
            h5 = h5py.File(self.h5file, "r")
        except Exception as e:
            fail(f"Failed to open HDF5 file: {e}")

        with h5:
            names = h5["meta/samples/names"].asstr()[:] #so that correctly decodes as string
            cols  = h5["meta/samples/col_idx"][:]
            start_pos = h5["meta/start"][:]

            num_sites_per_chrom = json.loads(h5.attrs['chrom_lengths'])
            # check if self.q_chrom doesn't exist
            if query_chrom not in num_sites_per_chrom:
                raise KeyError(f"{query_chrom} does not exist in the HDF5 file provided.")

            # Find rows that correspond to the query chromosome
            all_chromosomes = list(num_sites_per_chrom.keys())
            num_sites_pref_sum =  [0]*(len(all_chromosomes) + 1)
            for idx, chrom in enumerate(all_chromosomes):
                num_sites_pref_sum[idx + 1] = num_sites_pref_sum[idx] + num_sites_per_chrom[chrom]

            row_start, row_end = self.get_row_ranges_for_chrom(query_chrom, all_chromosomes, num_sites_pref_sum)
            target_start_pos = start_pos[row_start: row_end]
            print(f"{query_chrom}: [{target_start_pos[0]}, {target_start_pos[-1]}]")
            print(f"row range: [{row_start}, {row_end})")


            # Find the genomic range in HDF5 that is in the query range
            left  = np.searchsorted(target_start_pos, query_start, "left") # uses binary search
            right = np.searchsorted(target_start_pos, query_end, "right") # uses binary search

            if verbose:
                print("######### In the H5 file provided ###########")
                print(f"Total # of samples: {len(names)}")
                print(f"Total # of sites in {query_chrom}: {len(target_start_pos)}")
                print(f"Genomic range: [{target_start_pos[0]}, {target_start_pos[-1]}]")
                print()

            # For single point query, the genomic position must exist in the data
            if query_start == query_end:
                if left >= total_pos or query_start < target_start_pos[left]:
                    raise ValueError(f"{query_chrom}:{query_start} is not within the genomic bounds [{target_start_pos[0]}, {target_start_pos[-1]}] !")
                if query_start != target_start_pos[left]:
                    raise ValueError(f"No DNA methylation data for {query_chrom}:{query_start} !!!")
            else:
                # out-of-boundary case
                # left boundary
                if left >= num_sites_per_chrom[query_chrom]:
                   raise ValueError(f"{query_chrom}:{query_start} is not within the genomic bounds [{target_start_pos[0]}, {target_start_pos[-1]}] !")

                # right boundary
                if right <= 0: 
                    raise ValueError(f"{query_chrom}:{query_end} is not within the genomic bounds [{target_start_pos[0]}, {target_start_pos[-1]}] !")
                if left >= right:
                    raise ValueError(f"No DNA methylation data for the provided range {query_chrom}:[{query_start}, {query_end}] !!!")


            if verbose:
                print("######### Processing Queries ###########")
                print(f"Finding beta values in genomic range: [{target_start_pos[left]}, {target_start_pos[right-1]}]")
                print(f"# of beta values in the genomic range: {right - left}")
                print()
                print("####################")

            sample_to_col = dict(zip(names, cols))
            col_idx = [sample_to_col[s] for s in query_samples]
            dset = h5["/beta/values"]
            query_beta = dset[left:right, :]
            query_beta = query_beta[:, col_idx]
        return query_beta


def main(hdf_file, query_samples, query_string, verbose=False):
    if not os.path.exists(hdf_file):
        raise FileNotFoundError(f"HDF5 file not found: {hdf_file}")
    #print(json.dumps({"status": "error", "type": "Exception", "message": str(e)}), file=sys.stderr)
        #sys.exit(1)

    query_samples_list = query_samples.strip().split(',')
    q = Query(hdf_file)
    query_info = q.auto_detect(query_string)

    # Process based on query type
    if query_info['type'] == 'genomic':
        print(f"Processing genomic query:")
        print(f"  Chromosome: {query_info['chrom']}")
        print(f"  Range: {query_info['start']}-{query_info['end']}")
        q_chrom = query_info['chrom']
        q_start = query_info['start']
        q_end = query_info['end']
        # Call your genomic query function
        betavals = q.process_genomic_queries(query_samples_list, q_chrom,q_start, q_end, verbose)
        #print(betavals)
        # Convert numpy array to list for JSON serialization
        result = betavals.tolist()
        print(json.dumps(result))

    elif query_info['type'] == 'cpg':
        print(f"Processing CpG query:")
        print(f"  CpG IDs(first 5): {query_info['cpg_ids'][:5]}")
        print(f"  Count: {len(query_info['cpg_ids'])}")

        # Call your CpG query function
        start_t = time.time()
        betavals = q.process_cpg_queries(query_samples_list, query_info['cpg_ids'], verbose)
        end_t = time.time()
        print(f"Query time: {end_t-start_t:.4f} secs")
        #print(betavals)
        # Convert numpy array to list for JSON serialization
        result = betavals.tolist()
        print(json.dumps(result))


def parse_stdin():
    """Read JSON input from stdin"""
    if sys.stdin.isatty():
        return None  # no piped input
    data = sys.stdin.read().strip()
    if not data:
        return None

    try:
        inp = json.loads(data)
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON input: {e}", file=sys.stderr)
        sys.exit(1)

    return (
        inp.get("h"),
        inp.get("s"),
        inp.get("q"),
        inp.get("v", False),
        inp.get("validate", False),
    )

    #data = sys.stdin.read()
    #inp = json.loads(data)
    ## Extract expected fields
    #h = inp.get("h")
    #s = inp.get("s")
    #q = inp.get("q")
    #v = inp.get("v", False)
    #validate = inp.get("validate", False)

    #if data:
    #    try:
    #        obj = json.loads(data)
    #        return obj.get('h'), obj.get('s'), obj.get('q'), obj.get('v'), obj.get("validate")
    #    except json.JSONDecodeError as e:
    #        print(f"Error parsing JSON input: {e}", file=sys.stderr)
    #        sys.exit(1)
    #return None, None, None, None, None

def parse_cli_args():
    parser = argparse.ArgumentParser(
                description=(
                "Query DNA methylation beta values from an HDF5 file OR validate the HDF5 file structure.\n\n"
                "Modes:\n"
                "  1) Query mode: provide --h, --s, and --q\n"
                "  2) Validate mode: provide --h and --validate"),
                epilog=(
                "Examples:\n"
                "  Query genomic range:\n"
                "    python script.py --h data.h5 --s Sample1 --q chr1:100000-200000\n\n"
                "  Query CpG IDs:\n"
                "    python script.py --h data.h5 --s Sample1,Sample2 --q cg00000029,cg00000108\n\n"
                "  Validate HDF5 structure:\n"
                "    python script.py --h data.h5 --validate"
            ),
                formatter_class=argparse.ArgumentDefaultsHelpFormatter
            )
    parser.add_argument("--h", required=True, metavar="HDF5_File", help="path to HDF5 file of DNA methylation beta values")
    parser.add_argument("--s", metavar="SAMPLES", help="query sample(s)")
    parser.add_argument("--q", metavar="QUERY", help="genomic query range or CpG IDs")
    parser.add_argument("--v", action="store_true", help="enable verbose details output")
    parser.add_argument(
        "--validate",
        action="store_true",
        help="Validate HDF5 file structure instead of running a query",
    )
    args = parser.parse_args()
    return args.h, args.s, args.q, args.v, args.validate

def get_inputs():
    """Unified input handler (stdin JSON OR CLI)."""
    stdin_args = parse_stdin()
    if stdin_args is not None:
        return stdin_args
    return parse_cli_args()

def validate_inputs(hdf_file, query_samples, query_string, validate):
    """Validate that the required inputs are present for the selected mode."""
    if not hdf_file :
        print("Error: --h (HDF5 file) is required.", file=sys.stderr)
        sys.exit(1)
    if not os.path.exists(hdf_file):
        print(f"Error: HDF5 file {hdf_file} does not exist!", file=sys.stderr)
        sys.exit(1)
    if not validate:
        if not query_samples and not query_string:
            print("Error: --s (samples)  and --q (query string) is required for query mode.", file=sys.stderr)
            sys.exit(1)
        if not query_samples:
            print("Error: --s (samples) is required for query mode.", file=sys.stderr)
            sys.exit(1)
        if not query_string:
            print("Error: --q (query string) is required for query mode.", file=sys.stderr)
            sys.exit(1)

if __name__ == "__main__":
    hdf_file, query_samples, query_string, verbose, validate = get_inputs()
    validate_inputs(hdf_file, query_samples, query_string, validate)

    if validate:
        samples = validate_dnameth_hdf5(hdf_file)
        print(json.dumps(samples))
    else:
        main(hdf_file, query_samples, query_string, verbose)

