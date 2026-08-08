#!/usr/bin/env python3
import json
import os
import sys
import tempfile
from typing import Any
import h5py
import numpy as np

# Writes a gene-count HDF5 in the layout the DE engines already read (R/src/edge_newh5.R and
# rust/src/DEanalysis.rs): "item" = gene names, "samples" = sample names, "matrix" = (genes x
# samples) float32. This is the last step of the GDC differential-expression pipeline, where node
# has already downloaded and parsed the open-access STAR-Counts TSVs (see
# ppgdc/active/dataset/gdc/geneCounts.ts) and dumped the assembled matrix as a raw Float32Array.
#
# The matrix arrives as a side-channel binary file rather than inside the JSON because a
# 60,660-gene x 200-case matrix is ~60MB of JSON text and ~12M numbers to parse.
#
# Various JSON parameters:
#	out_file: path of the HDF5 file to write
#	f32_file: path of the raw little-endian float32 matrix, row-major (genes x samples)
#	genes: list of gene names, one per matrix row
#	samples: list of sample names, one per matrix column
#
# echo '{"out_file":"/tmp/x.h5","f32_file":"/tmp/x.f32","genes":["TP53"],"samples":["s1"]}' | python python/src/gdcCountsH5.py
# output: {"genes":1,"samples":1}
#
# echo '{"selftest":true}' | python python/src/gdcCountsH5.py
# output: {"selftest":"ok"}
MATRIX_NAME = "matrix"
ROW_NAME = "item"
COL_NAME = "samples"


def _json_out(obj: dict[str, Any]) -> None:
	print(json.dumps(obj, separators=(",", ":")))


def write_counts_hdf5(out_file: str, f32_file: str, genes: list[str], samples: list[str]) -> dict[str, Any]:
	expected = len(genes) * len(samples) * 4
	actual = os.path.getsize(f32_file)
	if actual != expected:
		raise ValueError(f"{f32_file} is {actual} bytes, expected {expected} for {len(genes)} genes x {len(samples)} samples")

	# "<f4" is explicit: node writes a host-endian Float32Array, and every platform this runs on is
	# little-endian. float32 matches the existing production counts h5 (H5T_IEEE_F32LE).
	matrix = np.fromfile(f32_file, dtype="<f4").reshape(len(genes), len(samples))

	string_type = h5py.string_dtype(encoding="utf-8")
	tmp_file = out_file + ".tmp"
	# tmp + rename so a crash mid-write never leaves a partial file that the next run would treat as
	# a valid cache hit
	with h5py.File(tmp_file, "w") as f:
		f.create_dataset(ROW_NAME, data=np.array(genes, dtype=object), dtype=string_type)
		f.create_dataset(COL_NAME, data=np.array(samples, dtype=object), dtype=string_type)
		f.create_dataset(MATRIX_NAME, data=matrix)
	os.replace(tmp_file, out_file)

	return {"genes": len(genes), "samples": len(samples)}


def _selftest() -> dict[str, Any]:
	"""Offline round-trip of the one detail that would otherwise silently produce a plausible but
	completely wrong volcano: the matrix axis order. Writes a 3-gene x 2-sample file and reads it
	back."""
	genes = ["TP53", "KRAS", "MYC"]
	samples = ["caseA", "caseB"]
	# row-major (genes x samples): gene i, sample j -> i*10 + j
	values = np.array([[0, 1], [10, 11], [20, 21]], dtype="<f4")
	with tempfile.TemporaryDirectory() as d:
		f32_file = os.path.join(d, "m.f32")
		out_file = os.path.join(d, "m.h5")
		values.tofile(f32_file)
		write_counts_hdf5(out_file, f32_file, genes, samples)

		with h5py.File(out_file, "r") as f:
			shape = f[MATRIX_NAME].shape
			if shape != (3, 2):
				raise AssertionError(f"matrix shape is {shape}, expected (3, 2) i.e. genes x samples")
			if f[MATRIX_NAME].dtype != np.dtype("<f4"):
				raise AssertionError(f"matrix dtype is {f[MATRIX_NAME].dtype}, expected float32")
			# .asstr() rather than a .decode() comprehension: h5py only hands back bytes for
			# variable-length string datasets by default, and .decode() would raise AttributeError
			# wherever it yields str instead. list() keeps the != below a list comparison -- .asstr()
			# slices to an ndarray, which would compare elementwise and make the if ambiguous.
			read_genes = list(f[ROW_NAME].asstr()[:])
			read_samples = list(f[COL_NAME].asstr()[:])
			if read_genes != genes:
				raise AssertionError(f"item is {read_genes}, expected {genes}")
			if read_samples != samples:
				raise AssertionError(f"samples is {read_samples}, expected {samples}")
			# MYC in caseB must be 21, not 11: catches a transposed write
			if f[MATRIX_NAME][2, 1] != 21:
				raise AssertionError(f"matrix[2,1] is {f[MATRIX_NAME][2, 1]}, expected 21")
		if os.path.exists(out_file + ".tmp"):
			raise AssertionError("tmp file was not renamed away")
	return {"selftest": "ok"}


def _parse_input(stdin_text: str) -> dict[str, Any]:
	payload = json.loads(stdin_text)
	if not isinstance(payload, dict):
		raise ValueError("Input JSON must be an object")
	if payload.get("selftest"):
		return {"selftest": True}

	for key in ("out_file", "f32_file"):
		if not isinstance(payload.get(key), str) or not payload[key]:
			raise ValueError(f"{key} must be a non-empty string path")
	for key in ("genes", "samples"):
		if not isinstance(payload.get(key), list) or not payload[key]:
			raise ValueError(f"{key} must be a non-empty list")
	if not os.path.isfile(payload["f32_file"]):
		raise FileNotFoundError(f"{payload['f32_file']} could not be found")
	return payload


def main() -> int:
	try:
		input_text = sys.stdin.read().strip()
		if not input_text:
			_json_out({"error": "No stdin input provided"})
			return 0

		input_data = _parse_input(input_text)
		if input_data.get("selftest"):
			_json_out(_selftest())
			return 0

		_json_out(
			write_counts_hdf5(
				input_data["out_file"],
				input_data["f32_file"],
				input_data["genes"],
				input_data["samples"],
			)
		)
		return 0

	except Exception as e:
		_json_out({"error": str(e)})
		return 0


if __name__ == "__main__":
	raise SystemExit(main())
