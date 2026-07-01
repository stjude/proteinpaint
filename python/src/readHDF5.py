#!/usr/bin/env python3
import json
from pathlib import Path
from os import getpid
import sys
import time
from typing import Any
import h5py
import numpy as np
from psutil import Process

# This script queries gene expression data from an HDF5 file and returns the results in JSON format. The script reads a list of gene names from standard input, retrieves their expression data across samples, and outputs the results along with timing information.
# Various JSON parameters:
#    genes: Enter the gene name(s) separated by comma
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


def _read_supported_datasets(hdf5_filename: str) -> tuple[list[str], list[str], Any]:
	with h5py.File(hdf5_filename, "r") as f:
		genes = _decode_string_array(f["item"][...])
		samples = _decode_string_array(f["samples"][...])
		matrix = np.asarray(f["matrix"][...], dtype=np.float64)

	if matrix.ndim != 2:
		raise ValueError("Expected 2D matrix for expression matrix")
	if matrix.shape[0] != len(genes):
		raise ValueError(f"Matrix rows ({matrix.shape[0]}) must equal number of genes ({len(genes)})")
	if matrix.shape[1] != len(samples):
		raise ValueError(f"Matrix columns ({matrix.shape[1]}) must equal number of samples ({len(samples)})")

	return genes, samples, matrix


def _build_samples_map(sample_keys: list[str], row: np.ndarray) -> dict[str, float | None]:
	return {sample: _safe_float(value) for sample, value in zip(sample_keys, row.tolist())}


def query_gene(hdf5_filename: str, gene_name: str) -> dict[str, Any]:
	genes, samples, matrix = _read_supported_datasets(hdf5_filename)
	try:
		gene_index = genes.index(gene_name)
	except ValueError as error:
		raise ValueError(f"Gene '{gene_name}' not found in the dataset") from error

	sample_keys = [sample.replace("\\", "") for sample in samples]
	return {
		"gene": gene_name,
		"dataId": gene_name,
		"samples": _build_samples_map(sample_keys, matrix[gene_index])
	}

def query_genes(hdf5_filename: str, gene_names: list[str]) -> dict[str, Any]:
	overall_start = time.perf_counter()
	timings: dict[str, Any] = {}
	genes, samples, matrix = _read_supported_datasets(hdf5_filename)
	t0 = time.perf_counter()
	gene_to_index: dict[str, int] = {gene: idx for idx, gene in enumerate(genes)}
	timings["build_hashmap_ms"] = int((time.perf_counter() - t0)*1000)

	sample_keys = [sample.replace("\\", "") for sample in samples]
	genes_map: dict[str, Any] = {}
	for gene_name in gene_names:
		gene_index = gene_to_index.get(gene_name)
		if gene_index is None:
			genes_map[gene_name] = {"error": f"Gene '{gene_name}' not found in the dataset"}
			continue
		genes_map[gene_name] = {
			"dataId": gene_name,
			"samples": _build_samples_map(sample_keys, matrix[gene_index])
		}
	return {
		"genes": genes_map,
		"timings": timings,
		"total_time_ms": int((time.perf_counter() - overall_start) * 1000)
	}




def _read_stdin_payload() -> str:
	payload = sys.stdin.read().strip()
	if not payload:
		raise ValueError("No JSON payload provided on stdin")
	return payload


def _parse_gene_names(genes_value: Any) -> list[str]:
	if isinstance(genes_value, str):
		genes = [gene.strip() for gene in genes_value.split(",") if gene.strip()]
	elif isinstance(genes_value, list):
		genes = [str(gene).strip() for gene in genes_value if str(gene).strip()]
	else:
		raise ValueError("genes must be a comma-separated string or a JSON list")

	if not genes:
		raise ValueError("genes must include at least one gene symbol")
	if len(genes) > 1000:
		raise ValueError("Too many genes requested; maximum is 1000")
	return genes


def _parse_input(stdin_text: str) -> tuple[str, list[str]]:
	payload = json.loads(stdin_text)
	if not isinstance(payload, dict):
		raise ValueError("Input JSON must be an object")

	hdf5_filename = payload.get("hdf5_file")
	if not isinstance(hdf5_filename, str) or not hdf5_filename:
		raise ValueError("hdf5_file must be a string path")
	if not Path(hdf5_filename).is_file():
		raise FileNotFoundError(f"{hdf5_filename} could not be found")
	if not h5py.is_hdf5(hdf5_filename):
		raise ValueError(f"{hdf5_filename} is not a valid hdf5")

	genes = _parse_gene_names(payload.get("genes"))
	return hdf5_filename, genes


def main() -> int:
	try:
		input_text = _read_stdin_payload()
		hdf5_filename, genes = _parse_input(input_text)
		file_format = detect_hdf5_format(hdf5_filename)
		if file_format != "supported":
			raise ValueError("Cannot query genes in unknown file format.")

		result = query_gene(hdf5_filename, genes[0]) if len(genes) == 1 else query_genes(hdf5_filename, genes)
		_json_out(result)
		return 0
	except Exception as e:
		print(f"Error: {e}", file=sys.stderr)
		return 1


if __name__ == "__main__":
	raise SystemExit(main())
