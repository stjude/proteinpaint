#!/usr/bin/env python3
import json
from pathlib import Path
import sys
import time
import traceback
from typing import Any
import h5py
import numpy as np

# This script queries data from an HDF5 file and returns the results in JSON format. The script reads a list of items from standard input, retrieves their corresponding rows as a dict, and outputs the results along with timing information.
# Various JSON parameters:
#	query?: Enter the item name(s) separated by comma
#	validate?: Boolean to retrieve sample names for a file
#		include_items?: Boolean to include the list of items in the output when validating
#		Between query and validate, only one should be set to true. If both are set, validate will override.
#		echo '{"validate":true,"hdf5_file":"server/test/tp/files/hg38/TermdbTest/rnaseq/TermdbTest.fpkm.matrix.new.h5"}' | python python/src/readHDF5.py
#		output: {
# 		"samples":["sample1","sample2","sample3"],
# 		"status": bool,
#		"message": "HDF5 matrix file loaded successfully"
#		"file_path": hdf5_filename,
#		"format": "matrix",
#                 "matrix_dimensions": {
#                     "num_rows": integer | 'unknown',
#                     "num_columns": integer | 'unknown'}
#	hdf5_file: Path to input file (HDF5 format)
#
# echo '{"query":["DDX11L1","MIR1302-2HG","MIR1302-2","FAM138A","OR4F5","AL627309.1","AL627309.3","AL627309.2","AL627309.5","AL627309.4"],"hdf5_file":"server/test/tp/files/hg38/TermdbTest/rnaseq/TermdbTest.fpkm.matrix.new.h5"}' | python python/src/readHDF5.py
# output: {"query_output":{"some_item":{"dataId":"some_item","samples":{"sample1":0.0,"sample2":1.0}}},"timings":{"build_hashmap_ms":5,"total_time_ms":15},'missing_items':["some_missing_item"]}
MATRIX_NAME= "matrix"
ROW_NAME = "item"
COL_NAME = "samples"


def _json_out(obj: dict[str, Any]) -> None:
	print(json.dumps(obj, separators=(",", ":")))


def _decode_string_array(arr: np.ndarray) -> list[str]:
	return [v.decode("utf-8", errors="ignore") if isinstance(v, (bytes, np.bytes_)) else str(v) for v in arr]

def validate_hdf5_file(hdf5_filename: str, include_items: bool = False) -> dict[str, Any]:
	
	file_format = detect_hdf5_format(hdf5_filename)
	result={
		"status": "failure",
		"message": (
			"Missing or invalid required datasets: "
			f"matrix='{MATRIX_NAME}', row_dataset='{ROW_NAME}', col_dataset='{COL_NAME}'"
		),
		"file_path": hdf5_filename,
		"format": "unknown",
		"matrix_dimensions": {"num_rows": 'unknown', "num_columns": 'unknown'}
	}
	if file_format == "supported":
		result["format"] = "matrix"
		with h5py.File(hdf5_filename, "r") as f:
			dataset = f[MATRIX_NAME]
			sample_count=int(f[COL_NAME].shape[0])
			item_count=int(f[ROW_NAME].shape[0])
			matrix_shape = dataset.shape
			col_data = [s.replace("\\", "") for s in _decode_string_array(f[COL_NAME][...])]
			if len(matrix_shape) == 2 and matrix_shape[0] == item_count and matrix_shape[1] == sample_count:
				try:
					_ = dataset[0:1, 0:1]
					matrix_valid = dataset.dtype.kind in {"f", "i", "u"}
					result['status']= "success" if matrix_valid else "failure"
					result['message'] = "HDF5 matrix file loaded successfully" if matrix_valid else "Invalid matrix structure"
					result["matrix_dimensions"] = {
										"num_rows": matrix_shape[0],
										"num_columns": matrix_shape[1]
										}
					result[COL_NAME] = col_data
					if include_items:
						result["items"] = _decode_string_array(f[ROW_NAME][...])
				except Exception:
					result["message"] = "Error reading matrix slice or datatype is not numeric"

	return result

def detect_hdf5_format(hdf5_filename: str) -> str:
	with h5py.File(hdf5_filename, "r") as f:
		has_counts = MATRIX_NAME in f
		has_samples = COL_NAME in f
		has_item_names = ROW_NAME in f
		if has_counts and has_samples and has_item_names:
			return "supported"
	return "unknown"


def query_hdf5(hdf5_filename: str, item_names: list[str]) -> dict[str, Any]:
	overall_start = time.perf_counter()
	timings: dict[str, Any] = {}

	batch_element_size = 400_000
	with h5py.File(hdf5_filename, "r") as f:
		items = _decode_string_array(f[ROW_NAME][...])
		samples = [s.replace("\\", "") for s in _decode_string_array(f[COL_NAME][...])]
		counts = f[MATRIX_NAME]
		counts_f8 = counts.astype("f8")
		t0 = time.perf_counter()
		item_to_index: dict[str, int] = {item: idx for idx, item in enumerate(items)}
		timings["build_hashmap_ms"] = int((time.perf_counter() - t0)*1000)
		items_left=[]
		missing=[]
		for item in item_names:
			if item not in item_to_index:
				missing.append(item)
				continue
			items_left.append(item)

		rows_per_chunk = max(1, batch_element_size // len(samples))
		items_map: dict[str, Any] = {}
		
		for start in range(0, len(items_left), rows_per_chunk):
			next_slice=slice(start, start + rows_per_chunk)
			item_index_map_chunk=((item, item_to_index[item]) for item in items_left[next_slice])
			sorted_pairs = sorted(item_index_map_chunk, key=lambda pair: pair[1])
			if not sorted_pairs:
				continue
			item_list_chunk = [pair[0] for pair in sorted_pairs]
			item_index_chunk = [pair[1] for pair in sorted_pairs]
			sorted_count_chunk = counts_f8[item_index_chunk, :]
			for item_name, row_values in zip(item_list_chunk, sorted_count_chunk):
				clean_values = np.where(np.isfinite(row_values), row_values, None)
				items_map[item_name] = {
					"dataId": item_name,
					"samples": dict(zip(samples, clean_values))
				}

		timings["total_time_ms"]=int((time.perf_counter() - overall_start)*1000)
		return {
			"query_output": items_map,
			"timings": timings,
			"missing_items": missing
		}

def _parse_item_names(items_value: Any) -> list[str]:
	if isinstance(items_value, str):
		items = [item.strip() for item in items_value.split(",") if item.strip()]
	elif isinstance(items_value, list):
		items = [str(item).strip() for item in items_value if str(item).strip()]
	else:
		raise ValueError("items must be a comma-separated string or a JSON list")
	if not items:
		raise ValueError("items must include at least one item symbol")
	if len(items) > 1000:
		raise ValueError("Too many items requested; maximum is 1000")
	return items


def _parse_input(stdin_text: str) -> dict[str, Any]:
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
	validate = payload.get("validate", False)
	if validate:
		return {
			"hdf5_file": hdf5_filename,
			"validate": True,
			"include_items": bool(payload.get("include_items", False))
		}
	items = _parse_item_names(payload.get("query"))
	return {
		"hdf5_file": hdf5_filename,
		"items": items,
		"validate": payload.get("validate", False),
		"include_items": bool(payload.get("include_items", False))
	}


def main() -> int:
	try:
		input_text = sys.stdin.read().strip()
		if not input_text:
			_json_out({"status": "error", "message": "No stdin input provided"})
			return 0

		input_data = _parse_input(input_text)
		hdf5_filename = input_data["hdf5_file"]
		items = input_data.get("items",None)
		validate = input_data.get("validate", False)
		include_items = input_data.get("include_items", False)
		validation_results = validate_hdf5_file(hdf5_filename,include_items=include_items)
		if validation_results["status"] == "success":
			if validate:
				_json_out(validation_results)
				return 0
			else:
				_json_out(query_hdf5(hdf5_filename, items))
				return 0

		_json_out(
			validation_results
		)
		return 0

	except Exception as e:
		_json_out({"status": "error", "message": str(e)})
		return 0


if __name__ == "__main__":
	raise SystemExit(main())
