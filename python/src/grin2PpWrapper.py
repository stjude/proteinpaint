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
#  lesionTypeMap: dict {lesionType: displayName}
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

import warnings, json, sys
import sqlite3
import pandas as pd
import numpy as np
from grin2_core import  grin_stats

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
	Sort by P-value in ascending order (smallest/most significant first)
	Priority: mutation > gain > loss > fusion > sv
	Checks both that columns exist AND have meaningful data
	"""
	# Get available p-value columns
	result = get_sig_values(data)
	p_cols = result["p_cols"]
	
	# Try each p-value column in priority order
	for col in p_cols:
		if col in data.columns and has_data(data[col]):
			return data.sort_values(col, ascending=True)
	
	raise ValueError("No p-value columns with data found for sorting")

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
		return {"X": 23, "Y": 24}.get(num, 100)

def get_user_friendly_label(col_name, lesion_type_map):
	"""
	Convert technical GRIN2 column names to user-friendly labels
	"""
	
	# Mapping for constellation tests
	constellation_map = {
		f"p{i}.nsubj": f"P-value ({i} Lesion Type{'s' if i > 1 else ''})"
		for i in range(1, 6)
	}
	constellation_map.update({
		f"q{i}.nsubj": f"Q-value ({i} Lesion Type{'s' if i > 1 else ''})"
		for i in range(1, 6)
	})
	
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

def check_data_types(sorted_results, p_cols):
	"""Check which data types have meaningful data"""
	data_types = ['mutation', 'gain', 'loss', 'fusion', 'sv']
	return {
		dt: has_data(sorted_results[p_cols[i]]) 
		for i, dt in enumerate(data_types) 
		if i < len(p_cols) and p_cols[i] in sorted_results.columns
	}

def check_constellation_columns(sorted_results):
	"""Check which constellation columns exist"""
	return {
		i: {
			'p': f'p{i}.nsubj' in sorted_results.columns,
			'q': f'q{i}.nsubj' in sorted_results.columns
		}
		for i in range(1, 6)
	}

def add_column_group(columns, p_col, q_col, n_col, lesion_type_map):
	"""Add a group of three columns (p-value, q-value, subject count)"""
	columns.extend([
		{"label": get_user_friendly_label(p_col, lesion_type_map), "sortable": True},
		{"label": get_user_friendly_label(q_col, lesion_type_map), "sortable": True},
		{"label": get_user_friendly_label(n_col, lesion_type_map), "sortable": True}
	])

def add_row_values(row_data, sorted_results, i, p_col, q_col, n_col):
	"""Add three values to a row (p-value, q-value, subject count)"""
	row_data.extend([
		{"value": smart_format(sorted_results.iloc[i][p_col])},
		{"value": smart_format(sorted_results.iloc[i][q_col])},
		{"value": smart_format(sorted_results.iloc[i][n_col])}
	])

def simple_column_filter(sorted_results, num_rows_to_process=50, lesion_type_map=None):
	"""
	Dynamically generate columns and rows for topGeneTable based on available data.
	Note: sorted_results is already sorted by sort_grin2_data() before being passed in.
	Args:
		sorted_results: DataFrame already sorted by sort_grin2_data()
		num_rows_to_process: Number of top genes to include in the table
		lesion_type_map: Dict mapping lesion types to display names (from client)
	"""
	result = get_sig_values(sorted_results)
	p_cols = result["p_cols"]
	q_cols = result["q_cols"]
	n_cols = result["n_cols"]
	
	# Check which data types and constellation columns have data
	data_type_status = check_data_types(sorted_results, p_cols)
	constellation_status = check_constellation_columns(sorted_results)

	# Build columns list
	columns = [
		{"label": "Gene", "sortable": True},
		{"label": "Chromosome", "sortable": True}
	]
	
	# Add columns for each data type that has data
	data_types = ['mutation', 'gain', 'loss', 'fusion', 'sv']
	for i, dt in enumerate(data_types):
		if data_type_status.get(dt, False):
			add_column_group(columns, p_cols[i], q_cols[i], n_cols[i], lesion_type_map)
	
	# Add constellation columns if they exist
	for i in range(1, 6):
		if constellation_status[i]['p'] and constellation_status[i]['q']:
			columns.extend([
				{"label": get_user_friendly_label(f"p{i}.nsubj", lesion_type_map), "sortable": True},
				{"label": get_user_friendly_label(f"q{i}.nsubj", lesion_type_map), "sortable": True}
			])

	# Build rows
	topgene_table_data = []
	for i in range(num_rows_to_process):
		row_data = [
			{"value": sorted_results.iloc[i]["gene"]},
			{"value": sorted_results.iloc[i]["chrom"]}
		]
		
		# Add data for each type that has data
		for idx, dt in enumerate(data_types):
			if data_type_status.get(dt, False):
				add_row_values(row_data, sorted_results, i, p_cols[idx], q_cols[idx], n_cols[idx])
		
		# Add constellation data
		for j in range(1, 6):
			if constellation_status[j]['p'] and constellation_status[j]['q']:
				row_data.extend([
					{"value": smart_format(sorted_results.iloc[i][f"p{j}.nsubj"])},
					{"value": smart_format(sorted_results.iloc[i][f"q{j}.nsubj"])}
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
		lesion_type_map = input_data.get("lesionTypeMap")
		if not lesion_type_map:
			write_error("lesionTypeMap not provided in input")
			sys.exit(1)
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
		data_types = [
			data_type 
			for option in available_types 
			for data_type in option_type_mapping.get(option, [])
		]
		
		if cache_file_path:
			cache_columns = ['gene', 'chrom']
			for t in data_types:
				for col_type in ['nsubj', 'q.nsubj']:
					col_name = f'{col_type}.{t}'
					if col_name in sorted_results.columns:
						cache_columns.append(col_name)
			
			# Create filtered dataframe with only cache columns
			results_to_cache = sorted_results[cache_columns].copy()

			# Add location columns
			results_to_cache['loc.start'] = sorted_results['loc.start']
			results_to_cache['loc.end'] = sorted_results['loc.end']
			 
			# Reorder columns to put pos right after chrom
			column_order = ['gene', 'chrom', 'loc.start', 'loc.end'] + [
				col for col in cache_columns if col not in ['gene', 'chrom']
			]
			results_to_cache = results_to_cache[column_order]

			# Save to TSV
			results_to_cache.to_csv(cache_file_path, index=False, sep='\t')

	except Exception as e:
		write_error(f"Failed to extract gene.hits or sort grin_table: {str(e)}")
		sys.exit(1)

		
	# 6. Generate topGeneTable
	max_genes_to_show = input_data.get("maxGenesToShow")
	num_rows_to_process = min(len(sorted_results), max_genes_to_show)
	table_result = simple_column_filter(sorted_results, num_rows_to_process, lesion_type_map)
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