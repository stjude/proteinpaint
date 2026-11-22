#!/usr/bin/env python3
"""
One sample's values of an HDF5 matrix (rows: genes or gene sets, columns: samples; datasets 'matrix',
'item', 'samples' as read by readHDF5.py), and for a group of samples the count, mean and standard
deviation of each row, from which the caller computes the sample's z-score against the group, and
optionally the group's boxplot values of each row, to show the sample's value against them.

input (stdin JSON):
	hdf5_file: path
	sample: sample name, a column
	items?: row names to read; all rows when absent
	log2?: true to use log2(value+1), e.g. for FPKM
	group?: sample names of the group to compute row statistics for
	box?: true to add the group's boxplot values of each row, as shared/utils/src/boxplot.ts computes them
output (stdout JSON):
	items: row names, in the order of the arrays below
	value: the sample's value of each row (log2(value+1) with log2), null when missing
	group: {n: [], mean: [], sd: []}, per row over the group's non-missing values; absent without input group;
		with box, also .box: {min: [], w1: [], p25: [], p50: [], p75: [], w2: [], max: []}, on the scale of
		value (log2(value+1) with log2), null for a row of fewer than 5 values
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
# boxplot values of each row, in the order of the output
BOX_KEYS = ("min", "w1", "p25", "p50", "p75", "w2", "max")


def _decode(arr) -> list:
	return [x.decode() if isinstance(x, bytes) else str(x) for x in arr]


def _round_list(a: np.ndarray, digits: int) -> list:
	# null for a missing value, as JSON has no NaN or Infinity
	return [None if not np.isfinite(v) else round(float(v), digits) for v in a]


def _box(sub: np.ndarray, n: np.ndarray) -> dict:
	"""the boxplot values of each row of sub (NaN for missing), as boxplot_getvalue() of shared/utils/src/boxplot.ts
	computes them from the row's ascending values: a quantile is the value at index floor(n * fraction), and the
	whiskers are the farthest values within 1.5 IQR of the box, both at the lower quartile when the IQR is 0"""
	# NaN sorts last, so the first n of a row are its values
	srt = np.sort(sub, axis=1)
	count = n.astype(int)

	def at(fraction: float) -> np.ndarray:
		i = np.clip(np.floor(count * fraction).astype(int), 0, np.maximum(count - 1, 0))
		return np.take_along_axis(srt, i[:, None], axis=1)[:, 0]

	p25, p50, p75 = at(0.25), at(0.5), at(0.75)
	iqr = p75 - p25
	w1 = np.nanmin(np.where(srt > (p25 - 1.5 * iqr)[:, None], srt, np.nan), axis=1)
	w2 = np.nanmax(np.where(srt <= (p75 + 1.5 * iqr)[:, None], srt, np.nan), axis=1)
	w1 = np.where(iqr == 0, p25, w1)
	w2 = np.where(iqr == 0, p25, w2)
	box = {"min": srt[:, 0], "w1": w1, "p25": p25, "p50": p50, "p75": p75, "w2": w2, "max": at(1)}
	# too few values for a box, as in boxplot_getvalue()
	return {k: np.where(count < 5, np.nan, v) for k, v in box.items()}


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
			box = {k: np.empty(len(rows)) for k in BOX_KEYS} if stats and q.get("box") else None
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
					sub = np.where(np.isfinite(sub), sub, np.nan)
					stats["n"][start:end] = np.sum(~np.isnan(sub), axis=1)
					stats["mean"][start:end] = np.nanmean(sub, axis=1)
					stats["sd"][start:end] = np.nanstd(sub, axis=1)
					if box:
						for k, v in _box(sub, stats["n"][start:end]).items():
							box[k][start:end] = v

			out = {"items": [names[i] for i in rows], "value": _round_list(value, 5)}
			if stats:
				out["group"] = {
					"n": [int(x) for x in stats["n"]],
					"mean": _round_list(stats["mean"], 7),
					"sd": _round_list(stats["sd"], 7),
				}
				if box:
					out["group"]["box"] = {k: _round_list(v, 5) for k, v in box.items()}
		sys.stdout.write(json.dumps(out))
		return 0
	except Exception as e:
		sys.stdout.write(json.dumps({"status": "error", "message": str(e)}))
		return 0


if __name__ == "__main__":
	raise SystemExit(main())
