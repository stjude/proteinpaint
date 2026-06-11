import json
import sys
from numpy import average
import pandas as pd
import pyBigWig as pybw
import requests

# This script reads a bigWig file and computes summary statistics (mean values) for a specified genomic region, divided into a specified number of bins. The results are returned as a JSON array of mean values for each bin.
# Various JSON parameters:
#    bw_file: Path to the bigWig file (can be a public url)
#    chromosome: Chromosome name (e.g., "chr1")
#    start: Start position of the region
#    end: End position of the region
#    n_bins: Number of bins to divide the region into (controls number of values returned i.e. n_bins=10 returns 10 mean values)
# echo '{"bw_file":"server/test/tp/files/hg38/TermdbTest/trackLst/bw1.bw", "chromosome":"chr17", "start":7666657, "end":7688274, "n_bins":100}' | python python/src/bigWigSummary.py
def _read_stdin_payload() -> str:
    payload = sys.stdin.read().strip()
    if not payload:
        raise ValueError("No JSON payload provided on stdin")
    return payload

def get_bigwig_stats(bw_file:str, chrom:str, start:int, end:int, n_bins:int) -> list[float | str] | None:
    try:
        bw = pybw.open(bw_file)
        if not bw.isBigWig():
            raise ValueError(f"{bw_file} is not a valid bigWig file")
        # returns tuple of (start, end, value) for each interval in the specified region
        interval_values:tuple[tuple[int,int,float]] = bw.intervals(chrom, start, end)
        intervals_df=pd.DataFrame([{'start': interval[0], 'end': interval[1], 'value': interval[2]} for interval in interval_values])
        intervals_length = (end - start) / n_bins
        def compute_bin_mean(bin_start:int, bin_end:int) -> float | str:
            bin_intervals = intervals_df[(intervals_df['start'] < bin_end) & (intervals_df['end'] > bin_start)]
            if bin_intervals.empty:
                return 'NaN'
            return average(bin_intervals['value'], weights=bin_intervals.apply(lambda row: min(row['end'], bin_end) - max(row['start'], bin_start), axis=1))
        stats = [compute_bin_mean(start + n * intervals_length, start + (n + 1) * intervals_length) for n in range(n_bins)]
        bw.close()
        return stats
    except Exception as e:
        raise ValueError(f"Error reading bigWig file: {e}")


def main() -> int:
    try:
        params_str = _read_stdin_payload()
        json_args = json.loads(params_str)
        if not isinstance(json_args, dict):
            raise ValueError("Input JSON must be a dict object")
        bw_file = json_args.get("bw_file")
        if not isinstance(bw_file, str):
            raise ValueError("bw_file must be a string path or url")
        if bw_file.startswith("http://") or bw_file.startswith("https://"):
            response=requests.head(bw_file, timeout=10).ok
            if not response:
                raise ValueError(f"URL {bw_file} is not accessible")
        
        chrom = json_args.get("chromosome")
        if not isinstance(chrom, str):
            raise ValueError("chromosome must be a string")
        start = json_args.get("start")
        if not isinstance(start, int):
            raise ValueError("start must be an integer")
        end = json_args.get("end")
        if not isinstance(end, int):
            raise ValueError("end must be an integer")
        if end <= start:
            raise ValueError("end must be greater than start")
        n_bins = json_args.get("n_bins")
        if not isinstance(n_bins, int) or n_bins < 1:
            raise ValueError("n_bins must be a positive integer")
        result = get_bigwig_stats(bw_file, chrom, start, end, n_bins)
        print(json.dumps(result))
        return 0
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
