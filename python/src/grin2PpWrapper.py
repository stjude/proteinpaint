###################
# grin2PpWrapper  #
###################

"""
Usage: echo <in_json> | python3 grin2PpWrapper.py

Input JSON:
{
 genedb: gene db file path
 chromosomelist={ <key>: <len>, }
 lesion: JSON string containing array of lesion data
 cacheFileName: string - will save GRIN2 results to this file
 availableDataTypes: [string]
 maxGenesToShow: int (default=500) 
 lesionTypeMap: dict {lesionType: displayName}
}

Output JSON:
{
 topGeneTable: {columns: [...], rows: [...]}
 totalGenes: int
 showingTop: int
 lesionCounts: {byType: dict{type: count}}
 cacheFileName: string
}
"""

import warnings, json, sys
import sqlite3
import pandas as pd
import numpy as np
from grin2_core import grin_stats

warnings.filterwarnings('ignore')

# Constants
OPTION_TO_LESION = {
	'snvindelOptions': ['mutation'],
	'cnvOptions': ['gain', 'loss'],
	'fusionOptions': ['fusion'],
	'svOptions': ['sv']
}

def write_error(msg):
	print(f"ERROR: {msg}", file=sys.stderr)

def get_sig_values(data):
	"""Find existing p/q/n columns for all data types"""
	# Define all possible column types to check for
	column_types = ["mutation", "gain", "loss", "fusion", "sv"]
	# Get all column names from the dataframe
	available_cols = data.columns
	# Create expected p-value column names
	expected_p_cols = [f"p.nsubj.{ct}" for ct in column_types]
	expected_n_cols = [f"nsubj.{ct}" for ct in column_types]
	# Find which p-value columns actually exist
	existing_p_cols = [col for col in expected_p_cols if col in available_cols]
	existing_n_cols = [col for col in expected_n_cols if col in available_cols]
	# Create corresponding q-value column names (assume they exist if p exists)
	existing_q_cols = [col.replace("p.nsubj.", "q.nsubj.") for col in existing_p_cols]
	return {
		"p_cols": existing_p_cols,
		"q_cols": existing_q_cols,
		"n_cols": existing_n_cols
	}

def has_data(column_data, sample_size=20):
	"""Check if column has meaningful data"""
	return (column_data.head(sample_size).notna() & (column_data.head(sample_size) != "")).any()

def smart_format(value):
	"""Format to 4 significant digits"""
	if pd.isna(value) or not np.isfinite(value):
		return None
	return 0 if value == 0 else float(f"{value:.3g}")

def sort_grin2_data(data, lesion_types):
	"""Sort by first available p-value with data"""
	p_cols = get_sig_values(data)["p_cols"]
	for col in p_cols:
		if has_data(data[col]):
			return data.sort_values(col, ascending=True)
	raise ValueError("No p-value columns with data found")

def get_user_friendly_label(col_name, lesion_type_map):
	"""Convert column names to user-friendly labels"""
	# Constellation pattern: p1.nsubj, q2.nsubj, etc.
	if len(col_name) > 1 and col_name[0] in 'pq' and col_name[1].isdigit() and col_name.endswith('.nsubj'):
		num = int(col_name[1])
		pq = 'P-value' if col_name[0] == 'p' else 'Q-value'
		return f"{pq} ({num} Lesion Type{'s' if num > 1 else ''})"
	
	# Data type patterns
	patterns = {
		'p.nsubj.': 'P-value',
		'q.nsubj.': 'Q-value',
		'nsubj.': 'Subject Count'
	}
	for prefix, label in patterns.items():
		if col_name.startswith(prefix):
			lesion_type = col_name[len(prefix):]
			if lesion_type in lesion_type_map:
				return f"{label} ({lesion_type_map[lesion_type]})"
	
	return col_name

def simple_column_filter(sorted_results, num_rows, lesion_type_map, lesion_types):
	"""Generate columns and rows for topGeneTable"""
	result = get_sig_values(sorted_results)
	p_cols, q_cols, n_cols = result["p_cols"], result["q_cols"], result["n_cols"]
	
	# Check data availability once
	data_type_has_data = [has_data(sorted_results[p_cols[i]]) for i in range(len(p_cols))]
	constellation_exists = [
		f'p{i}.nsubj' in sorted_results.columns and f'q{i}.nsubj' in sorted_results.columns
		for i in range(1, 6)
	]
	
	# Build columns
	columns = [
		{"label": "Gene", "sortable": True},
		{"label": "Chromosome", "sortable": True}
	]
	
	# Add data type columns - safely check n_cols length
	for i, has_data_flag in enumerate(data_type_has_data):
		if has_data_flag and i < len(n_cols):
			columns.extend([
				{"label": get_user_friendly_label(p_cols[i], lesion_type_map), "sortable": True},
				{"label": get_user_friendly_label(q_cols[i], lesion_type_map), "sortable": True},
				{"label": get_user_friendly_label(n_cols[i], lesion_type_map), "sortable": True}
			])
	
	# Add constellation columns
	for i, exists in enumerate(constellation_exists, 1):
		if exists:
			columns.extend([
				{"label": get_user_friendly_label(f"p{i}.nsubj", lesion_type_map), "sortable": True},
				{"label": get_user_friendly_label(f"q{i}.nsubj", lesion_type_map), "sortable": True}
			])
	
	# Build subset of columns to extract - safely check n_cols length
	subset_cols = ['gene', 'chrom']
	for i, has_data_flag in enumerate(data_type_has_data):
		if has_data_flag and i < len(n_cols):
			subset_cols.extend([p_cols[i], q_cols[i], n_cols[i]])
	
	for i, exists in enumerate(constellation_exists, 1):
		if exists:
			subset_cols.extend([f'p{i}.nsubj', f'q{i}.nsubj'])
	
	# Extract only needed rows and columns at once
	subset_df = sorted_results.iloc[:num_rows][subset_cols]
	
	# Build row data
	rows = []
	for idx in range(num_rows):
		row_vals = subset_df.iloc[idx]
		row_data = [
			{"value": row_vals["gene"]},
			{"value": row_vals["chrom"]}
		]
		
		# Add data type values - safely check n_cols length
		for i, has_data_flag in enumerate(data_type_has_data):
			if has_data_flag and i < len(n_cols):
				row_data.extend([
					{"value": smart_format(row_vals[p_cols[i]])},
					{"value": smart_format(row_vals[q_cols[i]])},
					{"value": smart_format(row_vals[n_cols[i]])}
				])
		
		# Add constellation values
		for i, exists in enumerate(constellation_exists, 1):
			if exists:
				row_data.extend([
					{"value": smart_format(row_vals[f'p{i}.nsubj'])},
					{"value": smart_format(row_vals[f'q{i}.nsubj'])}
				])
		
		rows.append(row_data)
	
	return {"columns": columns, "rows": rows}

try:
	# 1. Parse input
	json_input = sys.stdin.read().strip()
	if not json_input:
		write_error("No input data provided")
		sys.exit(1)
	
	input_data = json.loads(json_input)
	lesion_type_map = input_data.get("lesionTypeMap")
	if not lesion_type_map:
		write_error("lesionTypeMap not provided")
		sys.exit(1)
	
	# 2. Load gene annotations
	with sqlite3.connect(input_data["genedb"]) as con:
		gene_anno = pd.read_sql_query("SELECT name, chr, start, stop FROM gene2coord", con)
	
	if gene_anno.empty:
		write_error("No data in gene2coord table")
		sys.exit(1)
	
	# Remove header row if present and process
	gene_anno = gene_anno[
		~((gene_anno["name"] == "name") & (gene_anno["chr"] == "chr"))
	].assign(
		start=lambda x: pd.to_numeric(x["start"], errors="coerce").astype("int64"),
		stop=lambda x: pd.to_numeric(x["stop"], errors="coerce").astype("int64"),
		chr=lambda x: "chr" + x["chr"].str.replace("chr", "")
	).rename(columns={
		"name": "gene", "chr": "chrom", "start": "loc.start", "stop": "loc.end"
	})[["gene", "chrom", "loc.start", "loc.end"]]
	
	# 3. Create chromosome size table
	chromosomelist = input_data["chromosomelist"]
	chrom_size = pd.DataFrame({
		"chrom": list(chromosomelist.keys()),
		"size": pd.to_numeric(list(chromosomelist.values())).astype("int64")
	}).assign(
		sort_key=lambda x: x["chrom"].map(lambda c: int(c.replace("chr", "")) if c.replace("chr", "").isdigit() 
		                                   else {"X": 23, "Y": 24}.get(c.replace("chr", ""), 100))
	).sort_values("sort_key").drop(columns="sort_key")
	
	# 4. Parse lesion data
	lesion_array = json.loads(input_data["lesion"])
	if not lesion_array:
		write_error("No lesion data provided")
		sys.exit(1)
	
	lesion_df = pd.DataFrame(
		lesion_array, 
		columns=["ID", "chrom", "loc.start", "loc.end", "lsn.type"]
	).astype({
		"ID": str, "chrom": str, 
		"loc.start": "int64", "loc.end": "int64", 
		"lsn.type": str
	}).assign(
		chrom=lambda x: "chr" + x["chrom"].str.replace("chr", "")
	)
	
	lesion_counts = lesion_df["lsn.type"].value_counts()
	
	# Extract lesion types from available options
	lesion_types = [
		lesion_type
		for option in input_data.get("availableDataTypes", [])
		for lesion_type in OPTION_TO_LESION.get(option, [])
	]
	
	# 5. Run GRIN2
	grin_results = grin_stats(lesion_df, gene_anno, chrom_size)
	if not isinstance(grin_results, dict):
		write_error("grin_stats returned invalid results")
		sys.exit(1)
	
	# 6. Sort and cache results
	sorted_results = sort_grin2_data(grin_results["gene.hits"], lesion_types)
	
	cache_file_path = input_data.get("cacheFileName")
	if cache_file_path:
		cache_columns = ['gene', 'chrom'] + [
			f'{prefix}.{t}'
			for t in lesion_types
			for prefix in ['nsubj', 'q.nsubj']
			if f'{prefix}.{t}' in sorted_results.columns
		]
		
		# Save cache file
		results_to_cache = sorted_results[cache_columns + ['loc.start', 'loc.end']].copy()
		col_order = ['gene', 'chrom', 'loc.start', 'loc.end'] + [
			c for c in cache_columns if c not in ['gene', 'chrom']
		]
		results_to_cache[col_order].to_csv(cache_file_path, index=False, sep='\t')
	
	# 7. Generate table
	max_genes = input_data.get("maxGenesToShow", 500)
	num_rows = min(len(sorted_results), max_genes)
	table_result = simple_column_filter(sorted_results, num_rows, lesion_type_map, lesion_types)
	
	# 8. Output response
	print(json.dumps({
		"topGeneTable": table_result,
		"totalGenes": len(sorted_results),
		"showingTop": num_rows,
		"cacheFileName": cache_file_path,
		"lesionCounts": {"byType": lesion_counts.to_dict()}
	}))

except json.JSONDecodeError as e:
	write_error(f"Invalid JSON: {str(e)}")
	sys.exit(1)
except Exception as e:
	write_error(f"Unexpected error: {str(e)}")
	sys.exit(1)