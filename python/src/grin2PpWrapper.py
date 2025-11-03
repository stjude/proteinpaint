###################
# grin2PpWrapper  #
###################

########
# USAGE
########

"""
# Usage: echo <in_json> | python3 grin2PpWrapper.py

# in_json: [string] input data in JSON format. Streamed through stdin

# Input JSON:
# {
#  genedb: gene db file path
#  chromosomelist={ <key>: <len>, }
#  lesion: JSON string containing array of lesion data from gdcGRIN2.rs or other source such as the filter object in ProteinPaint
#  devicePixelRatio: float (default=2.0)
#  width: int (default=1000)
#  height: int (default=400)
#  pngDotRadius: int (default=2)
#  cacheFileName: string - will save GRIN2 results to this file in cache directory
#  availableDataTypes: [string]
#  maxGenesToShow: int (default=500) 
# }

# Output JSON:
# {
#  png: [<base64 string>]
#  topGeneTable: [<list>]
#  totalGenes: int
#  showingTop: int
#   lesionCounts: {
#		byType: dict{type: count}
#		}
#  cacheFileName: string
# }
"""

import warnings, json, sys, os
import sqlite3
import base64
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib as mpl
import numpy as np
from io import BytesIO
from grin2_core import order_index_gene_data, order_index_lsn_data, prep_gene_lsn_data, find_gene_lsn_overlaps, count_hits, row_bern_conv
from grin2_core import row_prob_subj_hit, p_order, process_block_in_chunks, prob_hits, grin_stats, write_grin_xlsx
from typing import Dict, Optional

# Suppress all warnings 
warnings.filterwarnings('ignore')

def write_error(msg):
	"Write error messages to stderr"
	print(f"ERROR: {msg}", file=sys.stderr)

def assign_lesion_colors(lesion_types):
	"""
	Function to determine color assignment based on mutation type
	Assign colors to lesion types based on what's present in the data
	"""
	color_map = {
		"mutation" : "#44AA44",   
        "gain" : "#FF4444",       
        "loss" : "#4444FF",
        "fusion" : "#FFA500",
        "sv" : "#9932CC"
	}
	# Find unique lesion types 
	unique_types = pd.Series(lesion_types).unique()
	# Check for unknown types
	unknown_types = set(unique_types) - set(color_map.keys())
	if unknown_types:
		warnings.warn(f"Unknown lesion types found: {', '.join(unknown_types)}")
	# Return colors for types present in data
	available_colors = {k: color_map[k] for k in unique_types if k in color_map}
	return available_colors


def sort_grin2_data(data):
	"""
	Sort Mutation data based on available p.nsubj columns with priority system
	Priority order:
		1. p.nsubj.mutation (highest priority - if available, always use this)
		2. p.nsubj.gain (medium priority - use if mutation not available)
		3. p.nsubj.loss (use if neither mutation nor gain available)
		4. p.nsubj.fusion (use if mutation, gain, loss not available)
		5. p.nsubj.sv (lowest priority - use only if no other columns available)
	"""
	# Define possible columns in priority order
	possible_cols = ["p.nsubj.mutation", "p.nsubj.gain", "p.nsubj.loss", "p.nsubj.fusion", "p.nsubj.sv"]
	# Find the first existing column
	for col in possible_cols:
		if col in data.columns:
			sort_column = col
			break
	else:
		raise ValueError("No sorting columns (p.nsubj.*) found in data")
	# Sort data
	sorted_data = data.sort_values(by=sort_column)
	return sorted_data

def get_chrom_key(chrom):
	"""
	Create a sorting key for chromosomes
	"""
	# Remove 'chr' prefix
	num = chrom.replace("chr","")
	# Check if numeric
	try:
		return int(num)
	except ValueError:
		# Assign fixed values for non-numeric
		if num == "X":
			return 23
		elif num == "Y":
			return 24
		else:
			return 100
def get_user_friendly_label(col_name):
	"""
	Convert technical GRIN2 column names to user-friendly labels
	"""
	# Mapping for lesion types
	lesion_type_map = {
		"mutation": "Mutation",
		"gain": "Copy Gain",
		"loss": "Copy Loss",
		"fusion": "Fusion",
		"sv": "Structural Variant"
	}
	
	# Mapping for constellation tests
	constellation_map = {
		"p1.nsubj": "P-value (1 Lesion Type)",
		"q1.nsubj": "Q-value (1 Lesion Type)",
		"p2.nsubj": "P-value (2 Lesion Types)",
		"q2.nsubj": "Q-value (2 Lesion Types)",
		"p3.nsubj": "P-value (3 Lesion Types)",
		"q3.nsubj": "Q-value (3 Lesion Types)",
		"p4.nsubj": "P-value (4 Lesion Types)",
		"q4.nsubj": "Q-value (4 Lesion Types)",
		"p5.nsubj": "P-value (5 Lesion Types)",
		"q5.nsubj": "Q-value (5 Lesion Types)"
	}
	
	# Check if it's a constellation column
	if col_name in constellation_map:
		return constellation_map[col_name]
	
	# Parse p.nsubj.*, q.nsubj.*, or nsubj.* columns
	for lesion_type, friendly_name in lesion_type_map.items():
		if col_name == f"p.nsubj.{lesion_type}":
			return f"P-value ({friendly_name})"
		elif col_name == f"q.nsubj.{lesion_type}":
			return f"Q-value ({friendly_name})"
		elif col_name == f"nsubj.{lesion_type}":
			return f"Subject Count ({friendly_name})"
	
	# If no match found, return original name
	return col_name

def get_sig_values(data):
	"""
	Find all existing p-value columns and return corresponding q-value columns
	Since q-values are guaranteed to exist whenever p-values exist,
	we only need to check for p-value columns and construct the corresponding
	q-value column names.
	"""
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
	# Create corresponding q-value column names
	# Simply replace "p.nsubj." with "q.nsubj."
	existing_q_cols = [col.replace("p.nsubj.", "q.nsubj.") for col in existing_p_cols]
	return {
		"p_cols": existing_p_cols,
		"q_cols": existing_q_cols,
		"n_cols": existing_n_cols
	}
def has_data(column_data, sample_size=20):
	"""
	Check if a column has meaningful data
	"""
	# Take a sample of the column (first 20 rows or whatever exists)
	sample_data = column_data.head(sample_size)
	# Remove NA, NULL, empty strings, and 0 values
	meaningful_data = sample_data[
		sample_data.notna() &
		(sample_data != "")
	]
	return len(meaningful_data) > 0

def smart_format(value):
    """Format to 4 significant digits but keep as numbers for proper sorting"""
    # Handle NaN, infinity, and other non-finite values
    if pd.isna(value) or not np.isfinite(value):
        return None  # Return None instead of NaN (becomes null in JSON)
    if value == 0:
        return 0
    else:
        # Convert to 4 significant digits and back to float
        return float(f"{value:.3g}")  # .3g gives 4 significant digits total
def simple_column_filter(sorted_results, num_rows_to_process=50):
	"""
	Dynamically generate columns and rows for topGeneTable based on available data
	"""
	result = get_sig_values(sorted_results)
	p_cols = result["p_cols"]
	q_cols = result["q_cols"]
	n_cols = result["n_cols"]
	
	# Check which column groups have data
	mutation_has_data = has_data(sorted_results[p_cols[0]]) if len(p_cols) > 0 and p_cols[0] in sorted_results.columns else False
	cnv_gain_has_data = has_data(sorted_results[p_cols[1]]) if len(p_cols) > 1 and p_cols[1] in sorted_results.columns else False
	cnv_loss_has_data = has_data(sorted_results[p_cols[2]]) if len(p_cols) > 2 and p_cols[2] in sorted_results.columns else False
	fusion_has_data = has_data(sorted_results[p_cols[3]]) if len(p_cols) > 3 and p_cols[3] in sorted_results.columns else False
	sv_has_data = has_data(sorted_results[p_cols[4]]) if len(p_cols) > 4 and p_cols[4] in sorted_results.columns else False
	
	# Check if constellation columns actually exist in the GRIN2 results
	p1_exists = 'p1.nsubj' in sorted_results.columns
	q1_exists = 'q1.nsubj' in sorted_results.columns
	p2_exists = 'p2.nsubj' in sorted_results.columns
	q2_exists = 'q2.nsubj' in sorted_results.columns
	p3_exists = 'p3.nsubj' in sorted_results.columns
	q3_exists = 'q3.nsubj' in sorted_results.columns
	p4_exists = 'p4.nsubj' in sorted_results.columns
	q4_exists = 'q4.nsubj' in sorted_results.columns
	p5_exists = 'p5.nsubj' in sorted_results.columns
	q5_exists = 'q5.nsubj' in sorted_results.columns
	
	# Sorting logic: Sort by Subject Count in descending order (largest first)
	# Priority: mutation > gain > loss > fusion > sv
	# Check both that the column exists AND has meaningful data
	sorted_column = None
	
	# Try mutation first
	if 'nsubj.mutation' in n_cols and 'nsubj.mutation' in sorted_results.columns:
		if has_data(sorted_results['nsubj.mutation']):
			sorted_column = 'nsubj.mutation'
	
	# Try gain
	if not sorted_column and 'nsubj.gain' in n_cols and 'nsubj.gain' in sorted_results.columns:
		if has_data(sorted_results['nsubj.gain']):
			sorted_column = 'nsubj.gain'
	
	# Try loss
	if not sorted_column and 'nsubj.loss' in n_cols and 'nsubj.loss' in sorted_results.columns:
		if has_data(sorted_results['nsubj.loss']):
			sorted_column = 'nsubj.loss'
	
	# Try fusion
	if not sorted_column and 'nsubj.fusion' in n_cols and 'nsubj.fusion' in sorted_results.columns:
		if has_data(sorted_results['nsubj.fusion']):
			sorted_column = 'nsubj.fusion'
	
	# Try sv
	if not sorted_column and 'nsubj.sv' in n_cols and 'nsubj.sv' in sorted_results.columns:
		if has_data(sorted_results['nsubj.sv']):
			sorted_column = 'nsubj.sv'
	
	# Final fallback to p-value sorting if no subject count data available
	if not sorted_column and 'p.nsubj.mutation' in sorted_results.columns:
		sorted_column = 'p.nsubj.mutation'
		sorted_results = sorted_results.sort_values(sorted_column, ascending=True)
	elif sorted_column:
		sorted_results = sorted_results.sort_values(sorted_column, ascending=False)

	# Build columns list
	columns = [
		{"label": "Gene", "sortable": True},
		{"label": "Chromosome", "sortable": True}
	]
	
	# Add individual mutation type columns based on what data exists
	if mutation_has_data:
		columns.extend([
			{"label": get_user_friendly_label(p_cols[0]), "sortable": True},
			{"label": get_user_friendly_label(q_cols[0]), "sortable": True},
			{"label": get_user_friendly_label(n_cols[0]), "sortable": True}
		])
	if cnv_gain_has_data:
		columns.extend([
			{"label": get_user_friendly_label(p_cols[1]), "sortable": True},
			{"label": get_user_friendly_label(q_cols[1]), "sortable": True},
			{"label": get_user_friendly_label(n_cols[1]), "sortable": True}
		])
	if cnv_loss_has_data:
		columns.extend([
			{"label": get_user_friendly_label(p_cols[2]), "sortable": True},
			{"label": get_user_friendly_label(q_cols[2]), "sortable": True},
			{"label": get_user_friendly_label(n_cols[2]), "sortable": True}
		])
	if fusion_has_data:
		columns.extend([
			{"label": get_user_friendly_label(p_cols[3]), "sortable": True},
			{"label": get_user_friendly_label(q_cols[3]), "sortable": True},
			{"label": get_user_friendly_label(n_cols[3]), "sortable": True}
		])
	if sv_has_data:
		columns.extend([
			{"label": get_user_friendly_label(p_cols[4]), "sortable": True},
			{"label": get_user_friendly_label(q_cols[4]), "sortable": True},
			{"label": get_user_friendly_label(n_cols[4]), "sortable": True}
		])
	
	# Add constellation columns based on what GRIN2 computed
	# The GRIN2 algorithm determines which constellation tests are relevant
	# We just display whichever constellation columns exist in the results
	
	# p1/q1: Gene affected by exactly 1 lesion type
	if p1_exists and q1_exists:
		columns.extend([
			{"label": get_user_friendly_label("p1.nsubj"), "sortable": True},
			{"label": get_user_friendly_label("q1.nsubj"), "sortable": True}
		])
	
	# p2/q2: Gene affected by exactly 2 lesion types
	if p2_exists and q2_exists:
		columns.extend([
			{"label": get_user_friendly_label("p2.nsubj"), "sortable": True},
			{"label": get_user_friendly_label("q2.nsubj"), "sortable": True}
		])
	
	# p3/q3: Gene affected by exactly 3 lesion types
	if p3_exists and q3_exists:
		columns.extend([
			{"label": get_user_friendly_label("p3.nsubj"), "sortable": True},
			{"label": get_user_friendly_label("q3.nsubj"), "sortable": True}
		])

	# p4/q4: Gene affected by exactly 4 lesion types
	if p4_exists and q4_exists:
		columns.extend([
			{"label": get_user_friendly_label("p4.nsubj"), "sortable": True},
			{"label": get_user_friendly_label("q4.nsubj"), "sortable": True}
		])
	
	# p5/q5: Gene affected by all 5 lesion types
	if p5_exists and q5_exists:
		columns.extend([
			{"label": get_user_friendly_label("p5.nsubj"), "sortable": True},
			{"label": get_user_friendly_label("q5.nsubj"), "sortable": True}
		])
	
	# Build rows to match the active columns
	topgene_table_data = []
	for i in range(min(len(sorted_results), num_rows_to_process)):
		row_data = [
			{"value": str(sorted_results.iloc[i]["gene"])},
			{"value": str(sorted_results.iloc[i]["chrom"])}
		]
		
		# Add individual mutation type data based on what exists
		if mutation_has_data:
			row_data.extend([
				{"value": smart_format(sorted_results.iloc[i][p_cols[0]])},
				{"value": smart_format(sorted_results.iloc[i][q_cols[0]])},
				{"value": smart_format(sorted_results.iloc[i][n_cols[0]])}
			])
		if cnv_gain_has_data:
			row_data.extend([
				{"value": smart_format(sorted_results.iloc[i][p_cols[1]])},
				{"value": smart_format(sorted_results.iloc[i][q_cols[1]])},
				{"value": smart_format(sorted_results.iloc[i][n_cols[1]])}
			])
		if cnv_loss_has_data:
			row_data.extend([
				{"value": smart_format(sorted_results.iloc[i][p_cols[2]])},
				{"value": smart_format(sorted_results.iloc[i][q_cols[2]])},
				{"value": smart_format(sorted_results.iloc[i][n_cols[2]])}
			])
		if fusion_has_data:
			row_data.extend([
				{"value": smart_format(sorted_results.iloc[i][p_cols[3]])},
				{"value": smart_format(sorted_results.iloc[i][q_cols[3]])},
				{"value": smart_format(sorted_results.iloc[i][n_cols[3]])}
			])
		if sv_has_data:
			row_data.extend([
				{"value": smart_format(sorted_results.iloc[i][p_cols[4]])},
				{"value": smart_format(sorted_results.iloc[i][q_cols[4]])},
				{"value": smart_format(sorted_results.iloc[i][n_cols[4]])}
			])
		
		# Add constellation data - just check if columns exist
		if p1_exists and q1_exists:
			row_data.extend([
				{"value": smart_format(sorted_results.iloc[i]["p1.nsubj"])},
				{"value": smart_format(sorted_results.iloc[i]["q1.nsubj"])}
			])
		
		if p2_exists and q2_exists:
			row_data.extend([
				{"value": smart_format(sorted_results.iloc[i]["p2.nsubj"])},
				{"value": smart_format(sorted_results.iloc[i]["q2.nsubj"])}
			])
		
		if p3_exists and q3_exists:
			row_data.extend([
				{"value": smart_format(sorted_results.iloc[i]["p3.nsubj"])},
				{"value": smart_format(sorted_results.iloc[i]["q3.nsubj"])}
			])
		
		if p4_exists and q4_exists:
			row_data.extend([
				{"value": smart_format(sorted_results.iloc[i]["p4.nsubj"])},
				{"value": smart_format(sorted_results.iloc[i]["q4.nsubj"])}
			])
		
		if p5_exists and q5_exists:
			row_data.extend([
				{"value": smart_format(sorted_results.iloc[i]["p5.nsubj"])},
				{"value": smart_format(sorted_results.iloc[i]["q5.nsubj"])}
			])
		
		topgene_table_data.append(row_data)
	
	return {
		"columns": columns,
		"rows": topgene_table_data
	}

try:
	# 1. Stream in JSON input data
	json_input = sys.stdin.read().strip()
	if not json_input:
		write_error("No input data provided")
		sys.exit(1)
	try:
		input_data = json.loads(json_input)
	except json.JSONDecodeError as e:
		write_error(f"Invalid JSON input: {str(e)}")
		sys.exit(1)
	# 2. Generate gene annotation table from gene2coord
	dbfile = input_data["genedb"]
	try:
		con = sqlite3.connect(dbfile)
		query = "SELECT name, chr, start, stop FROM gene2coord"
		gene_anno = pd.read_sql_query(query, con)
		con.close()
	except Exception as e:
		write_error(f"Failed to connect or query the gene database: {str(e)}")
		sys.exit(1)
	if gene_anno.empty:
		write_error("No data retrieved from gene2coord table")
		sys.exit(1)

	# Remove problematic header-like row
	gene_anno = gene_anno[
		~((gene_anno["name"] == "name") &
		(gene_anno["chr"] == "chr") &
		(gene_anno["start"] == "start") &
		(gene_anno["stop"] == "stop"))
	]
	# Ensure start and stop are integers and normalize chromosome names
	try:
		gene_anno = gene_anno.assign(
			start=lambda x: pd.to_numeric(x["start"], errors="coerce").astype("int64"),
			stop=lambda x: pd.to_numeric(x["stop"], errors="coerce").astype("int64"),
			chr=lambda x: x["chr"].apply(lambda c: f"chr{c}" if not c.startswith("chr") else c)
		)
	except Exception as e:
		write_error(f"Failed to convert start/stop to integers: {str(e)}")
		sys.exit(1)
	# Rename columns and add gene column
	gene_anno = gene_anno.rename(columns={
		"name": "gene.name",
		"chr": "chrom",
		"start": "loc.start",
		"stop": "loc.end"
	})
	gene_anno["gene"] = gene_anno["gene.name"]
	# Reorder columns
	gene_anno = gene_anno[["gene", "chrom", "loc.start", "loc.end"]]
	

	# 3. Generate chromosome size table
	try:
		chromosomelist = input_data["chromosomelist"]
		chrom_size = pd.DataFrame({
			"chrom": list(chromosomelist.keys()),
			"size": pd.to_numeric(list(chromosomelist.values()), errors="coerce").astype("int64")
		})
		chrom_size["sort_key"] = chrom_size["chrom"].apply(get_chrom_key)
		chrom_size = chrom_size.sort_values("sort_key").drop(columns="sort_key")
	except Exception as e:
		write_error(f"Failed to read chromosome size file: {str(e)}")
		sys.exit(1)

	# 4. Receive lesion data
	try:
		lesion_data = input_data["lesion"] 
		
		# Parse the JSON string to get the actual array
		lesion_array = json.loads(lesion_data)
		
		# Validate we have data
		if not lesion_array:
			write_error("No lesion data provided")
			sys.exit(1)
		
		# Create DataFrame from the parsed array
		lesion_df = pd.DataFrame(lesion_array, columns=["ID", "chrom", "loc.start", "loc.end", "lsn.type"])
		lesion_df = lesion_df.astype({
			"ID": str,
			"chrom": str,
			"loc.start": "int64",
			"loc.end": "int64",
			"lsn.type": str
		})
		lesion_df["chrom"] = lesion_df["chrom"].apply(lambda c: f"chr{c}" if not c.startswith("chr") else c)
		
		# Report lesion counts by type
		lesion_counts = lesion_df["lsn.type"].value_counts()
		lsn_colors = assign_lesion_colors(lesion_df["lsn.type"])
	except json.JSONDecodeError as json_err:
		write_error(f"Failed to parse lesion JSON: {json_err}")
		sys.exit(1)
	except Exception as e:
		write_error(f"Failed to read lesion data from input JSON: {str(e)}")
		sys.exit(1)

	# 5. Run GRIN2 analysis
	try:
		grin_results = grin_stats(lesion_df, gene_anno, chrom_size)
		if not isinstance(grin_results, dict) or grin_results is None:
			write_error("grin_stats returned invalid or null results")
			sys.exit(1)
	except Exception as e:
		write_error(f"Failed to compute grin_stats: {str(e)}")
		sys.exit(1)

	# Extract and sort gene.hits
	try:
		grin_table = grin_results["gene.hits"]
		sorted_results = sort_grin2_data(grin_table)

		cache_file_path = input_data.get("cacheFileName")
		available_types = input_data.get("availableDataTypes")
		# Dictionary to map data types coming from client to data types for cache file columns
		option_type_mapping = {
		'snvindelOptions': ['mutation'],
		'cnvOptions': ['gain', 'loss'],
		'fusionOptions': ['fusion'],
		'svOptions': ['sv']
		}

		# Determine which data types to include based on available options
		data_types = [data_type 
              for option in available_types 
              for data_type in option_type_mapping.get(option)]
		
		if cache_file_path:
			cache_columns = ['gene', 'chrom']
			for t in data_types:
				nsub_col = f'nsubj.{t}'
				q_col = f'q.nsubj.{t}'

				if nsub_col in sorted_results.columns:
					cache_columns.append(nsub_col)
				if q_col in sorted_results.columns:
					cache_columns.append(q_col)
				
				# Create filtered dataframe with only cache columns
				results_to_cache = sorted_results[cache_columns].copy()

				# Calculate pos as midpoint of loc.start and loc.end and make it an integer
				results_to_cache['loc.start'] = sorted_results['loc.start']
				results_to_cache['loc.end'] = sorted_results['loc.end']
				 
				 # Reorder columns to put pos right after chrom
				column_order = ['gene', 'chrom', 'loc.start', 'loc.end'] + [col for col in cache_columns if col not in ['gene', 'chrom']]
				results_to_cache = results_to_cache[column_order]


				# Save to TSV
				results_to_cache.to_csv(cache_file_path, index=False, sep='\t')

	except Exception as e:
		write_error(f"Failed to extract gene.hits or sort grin_table: {str(e)}")
		sys.exit(1)

		
	# 6. Generate topGeneTable
	max_genes_to_show = input_data.get("maxGenesToShow")
	num_rows_to_process = min(len(sorted_results), max_genes_to_show)
	table_result = simple_column_filter(sorted_results, num_rows_to_process)
	columns = table_result["columns"]
	topgene_table_data = table_result["rows"]

	# 7. Prepare response
	grin2_response = {
		"topGeneTable": {
			"columns": columns,
			"rows": topgene_table_data
		},
		"totalGenes": len(sorted_results),
		"showingTop": num_rows_to_process,
		"cacheFileName": cache_file_path,
		"lesionCounts": {
			"byType": lesion_counts.to_dict()
		}
	}

	# Output JSON
	print(json.dumps(grin2_response))
except Exception as e:
	write_error(f"Unexpected error: {str(e)}")
	sys.exit(1)