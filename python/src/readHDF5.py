#!/usr/bin/env python3
import json
from os import getpid
import sys
import time
from typing import Any
import h5py
import numpy as np
from psutil import Process

# This script queries gene expression data from an HDF5 file and returns the results in JSON format. The script reads a list of gene names from standard input, retrieves their expression data across samples, and outputs the results along with timing information.
# Various JSON parameters:
#    genes: Enter the gene name(s) separated by comma, must contain at least 10 genes
#    hdf5_file: Path to input file (HDF5 format)
# echo '{"genes":""DDX11L1","MIR1302-2HG","MIR1302-2","FAM138A","OR4F5","AL627309.1","AL627309.3","AL627309.2","AL627309.5","AL627309.4"","hdf5_file":"server/test/tp/files/hg38/TermdbTest/rnaseq/TermdbTest.fpkm.matrix.new.h5"}' | python python/src/readHDF5.py
# output: {"genes":{"some_gene":{"dataId":"some_gene","samples":{"sample1":0.0,"sample2":1.0}}},"timings":{"build_hashmap_ms":5},"total_time_ms":15}
def _json_out(obj: dict[str, Any]) -> None:
	print(json.dumps(obj, separators=(",", ":")))


def _decode_string_array(arr: np.ndarray) -> list[str]:
	result: list[str] = []
	for v in arr:
		if isinstance(v, (bytes, np.bytes_)):
			result.append(v.decode("utf-8", errors="ignore"))
		else:
			result.append(str(v))
	return result


def _safe_float(v: float) -> float | None:
	return float(v) if np.isfinite(v) else None


def detect_hdf5_format(hdf5_filename: str) -> str:
	with h5py.File(hdf5_filename, "r") as f:
		has_counts = "matrix" in f
		has_samples = "samples" in f
		has_gene_names = "item" in f
		if has_counts and has_samples and has_gene_names:
			return "supported"
	return "unknown"

# def query_gene_dense(hdf5_filename: str, gene_name: str) -> dict[str, Any]:
# 	with h5py.File(hdf5_filename, "r") as f:
# 		genes_key = "gene_ids" if "gene_ids" in f else "gene_names"
# 		if genes_key not in f:
# 			return {
# 				"status": "error",
# 				"message": "Failed to open gene_ids/gene_names dataset"
# 			}
# 		if "samples" not in f:
# 			return {"status": "error", "message": "Failed to open samples dataset"}
# 		if "counts" not in f:
# 			return {"status": "error", "message": "Failed to open counts dataset"}

# 		genes = _decode_string_array(f[genes_key][...])
# 		samples = _decode_string_array(f["samples"][...])
# 		counts = f["counts"]

# 		try:
# 			gene_index = genes.index(gene_name)
# 		except ValueError:
# 			return {
# 				"status": "error",
# 				"message": f"Gene '{gene_name}' not found in the dataset"
# 			}

# 		if len(counts.shape) != 2:
# 			return {"status": "error", "message": "Expected a 2D dataset for counts"}
# 		if gene_index >= counts.shape[0]:
# 			return {"status": "error", "message": "Gene index is out of bounds for the dataset"}

# 		gene_expression = counts[gene_index, :]
# 		samples_map: dict[str, float | None] = {}
# 		for i, sample in enumerate(samples):
# 			if i < len(gene_expression):
# 				samples_map[sample.replace("\\", "")] = _safe_float(gene_expression[i])

# 		return {
# 			"gene": gene_name,
# 			"dataId": gene_name,
# 			"samples": samples_map
# 		}


# def query_gene_sparse(hdf5_filename: str, gene_name: str) -> dict[str, Any]:
# 	with h5py.File(hdf5_filename, "r") as f:
# 		for required in ("data/dim", "gene_names", "sample_names", "data/p", "data/i", "data/x"):
# 			if required not in f:
# 				return {"status": "error", "message": f"Missing dataset/group: {required}"}

# 		data_dim = np.asarray(f["data/dim"][...], dtype=np.int64)
# 		num_samples = int(data_dim[0])

# 		genes = _decode_string_array(f["gene_names"][...])
# 		samples = _decode_string_array(f["sample_names"][...])

# 		try:
# 			gene_index = genes.index(gene_name)
# 		except ValueError:
# 			return {
# 				"status": "failure",
# 				"message": f"Gene '{gene_name}' not found in the HDF5 file '{hdf5_filename}'",
# 				"file_path": hdf5_filename,
# 				"gene": gene_name
# 			}

# 		p = np.asarray(f["data/p"][...], dtype=np.int64)
# 		i = np.asarray(f["data/i"][...], dtype=np.int64)
# 		x = np.asarray(f["data/x"][...], dtype=np.float64)

# 		start = int(p[gene_index])
# 		stop = int(p[gene_index + 1])
# 		col_ids = i[start:stop]
# 		col_values = x[start:stop]

# 		gene_array = np.zeros(num_samples, dtype=np.float64)
# 		gene_array[col_ids] = col_values

# 		samples_map: dict[str, float | None] = {}
# 		for idx, sample in enumerate(samples):
# 			if idx < len(gene_array):
# 				samples_map[sample.replace("\\", "")] = _safe_float(gene_array[idx])

# 		return {
# 			"gene": gene_name,
# 			"dataId": gene_name,
# 			"samples": samples_map
# 		}


# def query_gene(hdf5_filename: str, gene_name: str) -> dict[str, Any]:
# 	file_format = detect_hdf5_format(hdf5_filename)
# 	if file_format == "dense":
# 		return query_gene_dense(hdf5_filename, gene_name)
# 	if file_format == "sparse":
# 		return query_gene_sparse(hdf5_filename, gene_name)
# 	return {
# 		"status": "failure",
# 		"message": "Cannot query gene in unknown file format. Please use .h5 format in either sparse or dense format.",
# 		"file_path": hdf5_filename,
# 		"gene": gene_name,
# 		"format": "unknown"
# 	}


def query_genes(hdf5_filename: str, gene_names: list[str]) -> dict[str, Any]:
	overall_start = time.perf_counter()
	timings: dict[str, Any] = {}

	with h5py.File(hdf5_filename, "r") as f:
		batch_size = 200
		genes_key = "item"
		genes = _decode_string_array(f[genes_key][...])
		samples = _decode_string_array(f["samples"][...])
		counts = f["matrix"]

		t0 = time.perf_counter()
		gene_to_index: dict[str, int] = {g: idx for idx, g in enumerate(genes)}
		timings["build_hashmap_ms"] = int((time.perf_counter() - t0))

		missing = [gene for gene in gene_names if gene not in gene_to_index]
		if missing:
			return {
				"status": "error",
				"message": f"Gene '{missing[0]}' not found in the dataset"
			}

		requested_indices = np.fromiter((gene_to_index[g] for g in gene_names), dtype=np.int64)
		selected_rows = np.asarray(counts[requested_indices, :], dtype=np.float64)

		sample_keys = [s.replace("\\", "") for s in samples]
		genes_map: dict[str, Any] = {}
		for start in range(0, len(gene_names), batch_size):
			for gene_name, row in zip(gene_names[start:start + batch_size], selected_rows[start:start + batch_size]):
				row_values = row.astype(float, copy=True)
				row_values[~np.isfinite(row)] = None
				genes_map[gene_name] = {
					"dataId": gene_name,
					"samples": dict(zip(sample_keys, row_values.tolist()))
				}
	return {
		"genes": genes_map,
		"timings": timings,
		"total_time_ms": int((time.perf_counter() - overall_start) * 1000)
	}


# def query_multiple_genes_sparse(hdf5_filename: str, gene_names: list[str]) -> dict[str, Any]:
# 	overall_start = time.perf_counter()
# 	timings: dict[str, Any] = {
# 		"gene_count": len(gene_names),
# 		"format": "sparse"
# 	}

# 	with h5py.File(hdf5_filename, "r") as f:
# 		for required in ("data/dim", "gene_names", "sample_names", "data/p", "data/i", "data/x"):
# 			if required not in f:
# 				return {"status": "error", "message": f"Missing dataset/group: {required}"}

# 		dim_start = time.perf_counter()
# 		data_dim = np.asarray(f["data/dim"][...], dtype=np.int64)
# 		num_samples = int(data_dim[0])
# 		timings["read_dims_ms"] = int((time.perf_counter() - dim_start) * 1000)

# 		genes = _decode_string_array(f["gene_names"][...])
# 		samples = _decode_string_array(f["sample_names"][...])
# 		p = np.asarray(f["data/p"][...], dtype=np.int64)
# 		i = np.asarray(f["data/i"][...], dtype=np.int64)
# 		x = np.asarray(f["data/x"][...], dtype=np.float64)

# 		gene_to_index = {g: idx for idx, g in enumerate(genes)}
# 		genes_map: dict[str, Any] = {}

# 		for gene_name in gene_names:
# 			idx = gene_to_index.get(gene_name)
# 			if idx is None:
# 				genes_map[gene_name] = {"error": "Gene not found in dataset"}
# 				continue

# 			start = int(p[idx])
# 			stop = int(p[idx + 1])

# 			gene_array = np.zeros(num_samples, dtype=np.float64)
# 			if stop > start:
# 				col_ids = i[start:stop]
# 				col_values = x[start:stop]
# 				gene_array[col_ids] = col_values

# 			samples_map: dict[str, float | None] = {}
# 			for j, sample in enumerate(samples):
# 				if j < len(gene_array):
# 					samples_map[sample.replace("\\", "")] = _safe_float(gene_array[j])

# 			genes_map[gene_name] = {
# 				"dataId": gene_name,
# 				"samples": samples_map
# 			}

# 	return {
# 		"genes": genes_map,
# 		"timings": timings,
# 		"parallel": False,
# 		"total_time_ms": int((time.perf_counter() - overall_start) * 1000)
# 	}

def get_memory_mb():
    """Return current process memory usage in MB."""
    try:
        return round(Process(getpid()).memory_info().rss / (1024 * 1024), 2)
    except Exception as e:
         print(f"Failed to get memory usage: {e}")
		 
def _parse_input(stdin_text: str) -> tuple[str, str | list[str]]:
	payload = json.loads(stdin_text)
	hdf5_filename = payload.get("hdf5_file")
	if not isinstance(hdf5_filename, str) or not hdf5_filename:
		raise ValueError("HDF5 filename not provided")

	genes = payload.get("genes")
	genes = [g.strip() for g in genes.split(",") if g.strip()] 
	if isinstance(genes, list):
		str_genes = [g for g in genes if isinstance(g, str)]
		if len(str_genes)<=1000:
			return hdf5_filename, str_genes
		else:
			raise ValueError("Too many genes requested; maximum is 1000")
	raise ValueError("Neither gene nor genes array provided in input")


def main() -> int:
	try:
		input_text = sys.stdin.read().strip()
		if not input_text:
			_json_out({"status": "error", "message": "No stdin input provided"})
			return 1

		hdf5_filename, genes = _parse_input(input_text)


		file_format = detect_hdf5_format(hdf5_filename)
		if file_format == "supported":
			_json_out(query_genes(hdf5_filename, genes))
			return 0

		_json_out(
			{
				"status": "failure",
				"message": "Cannot query genes in unknown file format.",
				"file_path": hdf5_filename
			}
		)
		return 0

	except Exception as e:
		_json_out({"status": "error", "message": str(e)})
		return 1


if __name__ == "__main__":
	raise SystemExit(main())
