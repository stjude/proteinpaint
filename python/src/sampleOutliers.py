#!/usr/bin/env python3
"""
One sample's values of an HDF5 matrix (rows: genes or gene sets, columns: samples; datasets 'matrix',
'item', 'samples' as read by readHDF5.py), and for a group of samples the count, mean and standard
deviation of each row, from which the caller computes the sample's z-score against the group.

input (stdin JSON):
	hdf5_file: path
	sample: sample name, a column
	items?: row names to read; all rows when absent
	log2?: true to use log2(value+1), e.g. for FPKM
	group?: sample names of the group to compute row statistics for
output (stdout JSON):
	items: row names, in the order of the arrays below
	value: the sample's value of each row (log2(value+1) with log2), null when missing
	group: {n: [], mean: [], sd: []}, per row over the group's non-missing values; absent without input group
	or {status: 'error', message}

Rows are read in blocks so that the statistics of a whole-transcriptome matrix need not be in memory
at once.
"""
import json
import sys
import warnings

import h5py
import numpy as np

# rows per read: 250 rows of a 5k-sample float32 matrix are 5 MB, with a few copies of that per block
BLOCK_ROWS = 250


def _decode(arr) -> list:
	return [x.decode() if isinstance(x, bytes) else str(x) for x in arr]


def _round_list(a: np.ndarray, digits: int) -> list:
	# null for a missing value, as JSON has no NaN or Infinity
	return [None if not np.isfinite(v) else round(float(v), digits) for v in a]


def main() -> int:
	try:
		q = json.loads(sys.stdin.read())
		with h5py.File(q["hdf5_file"], "r") as f:
			matrix = f["matrix"]
			samples = _decode(f["samples"][...])
			col = {s: i for i, s in enumerate(samples)}
			if q["sample"] not in col:
				raise ValueError("sample not in file")
			names = _decode(f["item"][...])
			if q.get("items"):
				wanted = set(q["items"])
				rows = [i for i, n in enumerate(names) if n in wanted]
			else:
				rows = list(range(len(names)))
			j = col[q["sample"]]
			group = None if q.get("group") is None else [col[s] for s in q["group"] if s in col]

			value = np.empty(len(rows))
			stats = None if group is None else {"n": np.empty(len(rows)), "mean": np.empty(len(rows)), "sd": np.empty(len(rows))}
			for start in range(0, len(rows), BLOCK_ROWS):
				# all rows are read by a slice: h5py reads a list of indices much slower than a range
				block_rows = rows[start : start + BLOCK_ROWS] if q.get("items") else slice(start, min(start + BLOCK_ROWS, len(rows)))
				# every column of the block's rows for the group statistics, else only the sample's
				block = matrix[block_rows, :] if stats else matrix[block_rows, j]
				block = block.astype(np.float32, copy=False)
				end = start + block.shape[0]
				# a value of -1 or below would have no log2(value+1), and a row missing in every sample of the
				# group no statistics: both give NaN without numpy's warnings, which run_python() would take
				# as a failure
				with warnings.catch_warnings(), np.errstate(invalid="ignore", divide="ignore"):
					warnings.simplefilter("ignore", RuntimeWarning)
					if q.get("log2"):
						block = np.log2(block + 1)
					if not stats:
						value[start:end] = block
						continue
					value[start:end] = block[:, j]
					sub = block[:, group]
					stats["n"][start:end] = np.sum(~np.isnan(sub), axis=1)
					stats["mean"][start:end] = np.nanmean(sub, axis=1)
					stats["sd"][start:end] = np.nanstd(sub, axis=1)

			out = {"items": [names[i] for i in rows], "value": _round_list(value, 5)}
			if stats:
				out["group"] = {
					"n": [int(x) for x in stats["n"]],
					"mean": _round_list(stats["mean"], 7),
					"sd": _round_list(stats["sd"], 7),
				}
		sys.stdout.write(json.dumps(out))
		return 0
	except Exception as e:
		sys.stdout.write(json.dumps({"status": "error", "message": str(e)}))
		return 0


if __name__ == "__main__":
	raise SystemExit(main())
