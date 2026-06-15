import json
from pathlib import Path
import sys
import pyBigWig as pybw

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

def get_bigwig_stats(bw_file:str, chrom:str, start:int, end:int, n_bins:int) -> list[float | None]:
    try:
        bw = pybw.open(bw_file)
        if not bw.isBigWig():
            raise ValueError(f"Error reading non-valid bigWig file")
        stats = [stat if stat is not None else 'NA' for stat in bw.stats(chrom, start, end, nBins=n_bins, type="mean")]
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
