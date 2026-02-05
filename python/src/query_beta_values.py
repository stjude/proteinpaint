import h5py
import numpy as np
import os
import argparse
import json, sys

class Query:
    def __init__(self, input_file, query_samples, genomic_query):
        self.q_chrom = ''
        self.q_start = 0
        self.q_end = 0
        self.q_samples = query_samples
        self.h5file = input_file
        self.parse_genomic_query(genomic_query)

        #print("Genomic range of query:", flush=True)
        #print(f"{self.q_chrom}: [{self.q_start}, {self.q_end}]", flush=True)


    def parse_genomic_query(self, genomic_query):
        # parse the genomic query first
        tokens = genomic_query.split(':')
        self.q_chrom = tokens[0]

        # check if single pos or not
        sub_tokens = tokens[1].split('-')
        if len(sub_tokens) < 2:
            self.q_start = int(sub_tokens[0])
            self.q_end = int(sub_tokens[0])
        else:
            self.q_start = int(sub_tokens[0])
            self.q_end = int(sub_tokens[1])

    def process_queries(self, verbose=False):
        assert os.path.exists(self.h5file)
        try:
            with h5py.File(self.h5file) as h5:
                names = h5["meta/samples/names"].asstr()[:] #so that correctly decodes as string
                cols  = h5["meta/samples/col_idx"][:]

                if self.q_chrom not in h5:
                    raise KeyError(f"{self.q_chrom} not found in HDF5 file.")
                grp = h5[self.q_chrom]
                starts = grp["start"][:]
                total_pos = len(starts)
                left  = np.searchsorted(starts, self.q_start, "left") # uses binary search
                right = np.searchsorted(starts, self.q_end, "right")

                if verbose:
                    print("######### In the H5 file provided ###########")
                    print(f"Total # of samples: {len(names)}")
                    print(f"Total # of CpG sites in {self.q_chrom}: {len(starts)}")
                    print(f"Genomic range: [{starts[0]}, {starts[-1]}]")
                    print()

                # For single point query, the genomic position must exist in the data
                if self.q_start == self.q_end:
                    if left >= total_pos or self.q_start < starts[left]:
                        raise ValueError(f"{self.q_chrom}:{self.q_start} is not within the genomic bounds [{starts[0]}, {starts[-1]}] !")
                    if self.q_start != starts[left]:
                        raise ValueError(f"No DNA methylation data for {self.q_chrom}:{self.q_start} !!!")
                else:
                    # out-of-boundary case
                    # left boundary
                    if left >= total_pos:
                       raise ValueError(f"{self.q_chrom}:{self.q_start} is not within the genomic bounds [{starts[0]}, {starts[-1]}] !")
                    # right boundary
                    if right <= 0: 
                        raise ValueError(f"{self.q_chrom}:{self.q_end} is not within the genomic bounds [{starts[0]}, {starts[-1]}] !")

                if verbose:
                    print("######### Processing Queries ###########")
                    print(f"Finding beta values in genomic range: [{starts[left]}, {starts[right-1]}]")
                    print(f"# of beta values in the genomic range: {right - left}")
                    print()
                    print("####################")

                sample_to_col = dict(zip(names, cols))
                col_idx = [] 
                for s in self.q_samples:
                    if s not in sample_to_col:
                        raise KeyError(f"Sample(s) not found in HDF5 file.")
                    col_idx.append(sample_to_col[s])
                query_beta = grp["beta"][left:right,: ]
                query_beta = query_beta[:, col_idx]
        except KeyError as e:
            print(json.dumps({"status": "error", "type": "KeyError", "message": str(e.args[0])}), file=sys.stderr)
            sys.exit(1)
        except ValueError as e:
            print(json.dumps({"status": "error", "type": "ValueError", "message": str(e)}), file=sys.stderr)
            sys.exit(1)
        except Exception as e:
            print(json.dumps({"status": "error", "type": "Exception", "message": str(e)}), file=sys.stderr)
            sys.exit(1)

        return query_beta

def main(hdf_file, query_samples, genomic_query):
    if not os.path.exists(hdf_file):
        raise FileNotFoundError(f"HDF5 file not found: {hdf_file}")
    #print(json.dumps({"status": "error", "type": "Exception", "message": str(e)}), file=sys.stderr)
        #sys.exit(1)
    query_samples_list = query_samples.strip().split(',')
    q = Query(hdf_file, query_samples_list, genomic_query)
    betavals = q.process_queries()
    # Convert numpy array to list for JSON serialization
    result = betavals.tolist()

    # Output as JSON
    print(json.dumps(result))

def parse_stdin():
    """Try to read JSON input from stdin"""
    data = sys.stdin.read()
    inp = json.loads(data)
    # Extract expected fields
    h = inp.get("h")
    s = inp.get("s")
    g = inp.get("g")
    if data:
        try:
            obj = json.loads(data)
            return obj.get('h'), obj.get('s'), obj.get('g')
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON input: {e}", file=sys.stderr)
            sys.exit(1)
    return None, None, None

def parse_cli_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--h", required=True, help="HDF5 file")
    parser.add_argument("--s", required=True, help="query sample (s)")
    parser.add_argument("--g", required=True, help="genomic query range")
    args = parser.parse_args()
    return args.h, args.s, args.g

if __name__ == "__main__":
    hdf_file, query_samples, genomic_query = parse_stdin()
    main(hdf_file, query_samples, genomic_query)





