import h5py
import numpy as np
import os
import argparse

class Query:
    def __init__(self, input_file, query_samples, genomic_query):
        self.q_chrom = ''
        self.q_start = 0
        self.q_end = 0
        self.q_samples = query_samples
        self.h5file = input_file
        self.parse_genomic_query(genomic_query)

        print("Genomic range of query:")
        print(f"{self.q_chrom}: [{self.q_start}, {self.q_end}]")

        #self.process_queries()

    def parse_genomic_query(self, genomic_query):
        # parse the genomic query first
        tokens = genomic_query.split(':')
        self.q_chrom = tokens[0]

        # TODO: check if it's valid chromosome

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
        with h5py.File(self.h5file) as h5:
            names = h5["meta/samples/names"].asstr()[:] #so that correctly decodes as string
            cols  = h5["meta/samples/col_idx"][:]
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
                    print(f"{self.q_chrom}:{self.q_start} is not within the existing genomic bounds [{starts[0]}, {starts[-1]}] !")
                    exit(1)
                if self.q_start != starts[left]:
                    print(f"No DNA methylation data for {self.q_chrom}:{self.q_start} !!!")
                    exit(1)
            else:
                # out-of-boundary case
                # left boundary
                if left >= total_pos:
                   print(f"{self.q_chrom}:{self.q_start} is not within the bounds [{starts[0]}, {starts[-1]}] !")
                   exit(1)

                # right boundary
                if right <= 0: 
                    print(f"{self.q_chrom}:{self.q_end} is not within the bounds [{starts[0]}, {starts[-1]}] !")
                    exit(1)

            if verbose:
                print("######### Processing Queries ###########")
                print(f"Finding beta values in genomic range: [{starts[left]}, {starts[right-1]}]")
                print(f"# of beta values in the genomic range: {right - left}")
                print()
                print("####################")

            sample_to_col = dict(zip(names, cols))
            col_idx = [sample_to_col[s] for s in self.q_samples]

            query_beta = grp["beta"][left:right:,: ]
            query_beta = query_beta[:, col_idx]

        return query_beta

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("--h", required=True, help="HDF5 file")
    parser.add_argument("--s", required=True, help="query sample (s)")
    parser.add_argument("--g", required=True, help="genomic query range")

    args = parser.parse_args()
    hdf_file = args.h
    query_samples = args.s
    genomic_query = args.g
    assert os.path.exists(hdf_file)

    query_samples_list = query_samples.strip().split(',')
    q = Query(hdf_file, query_samples_list, genomic_query)
    betavals = q.process_queries(verbose=True)
    print(betavals)





