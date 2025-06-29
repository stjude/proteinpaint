###################
# gdcGRIN2         #
###################

########
# USAGE
########

"""
# Usage: echo <in_json> | python3 gdcGRIN2.py

# in_json: [string] input data in JSON format. Streamed through stdin

# Input JSON:
# {
#  genedb: gene db file path
#  chromosomelist={ <key>: <len>, }
#  lesion: flattened string from the output of gdcGRIN2.rs
# }

# Output JSON:
# {
#  png: [<base64 string>]
#  topGeneTable: [<list>]
#  totalGenes: int
#  showingTop: int
# }
"""

import warnings, json, sys, os
import sqlite3
import base64
import pandas as pd
import matplotlib.pyplot as plt
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
        "loss" : "#4444FF"  
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

def plot_grin2_manhattan(grin_results: dict, 
                        chrom_size: pd.DataFrame,
                        colors: Optional[Dict[str, str]] = None) -> plt.Figure:
    """
    Create a Manhattan plot for GRIN2 genomic analysis results using colored scatter points.
    
    This function generates a genome-wide visualization showing the statistical 
    significance of genomic alterations across all chromosomes. Each point represents 
    a gene with its significance level (-log₁₀(q-value)) plotted against its chromosome
    start position. Different mutation types (gain, loss, mutation) are shown in different colors.
    
    The plot displays:
    - X-axis: Chromosome start positions (simple coordinate system)
    - Y-axis: Statistical significance as -log₁₀(q-value) 
    - Colors: Different mutation types (CNV gains, losses, point mutations)
    - Threshold lines: Common significance levels (q=0.05, 0.01, 0.001)
    
    Args:
        grin_results (dict): Results dictionary from grin_stats() function containing:
            - 'gene.hits': DataFrame with gene-level statistical results
                Required columns:
                - 'chrom': Chromosome names  
                - 'loc.start': Gene start positions
                - 'q.nsubj.gain': Q-values for CNV gains (optional)
                - 'q.nsubj.loss': Q-values for CNV losses (optional)  
                - 'q.nsubj.mutation': Q-values for point mutations (optional)
                
        chrom_size (pd.DataFrame): Chromosome size information with columns:
            - 'chrom': Chromosome names (must match those in grin_results)
            - 'size': Chromosome lengths in base pairs
            
        colors (Optional[Dict[str, str]]): Color mapping for mutation types.
            Keys should be 'gain', 'loss', 'mutation'. If None, uses defaults:
            - 'gain': '#FF4444' (red)  
            - 'loss': '#4444FF' (blue)
            - 'mutation': '#44AA44' (green)
            
    Returns:
        plt.Figure: Matplotlib figure object containing the Manhattan plot.
            The figure is ready for saving, displaying, or further customization.
            
    Raises:
        KeyError: If required columns are missing from input DataFrames
        ValueError: If no valid q-value columns are found in grin_results
        
        
    Notes:
        - Genes with q-values ≤ 0 or missing values are excluded from plotting
        - Only points with -log₁₀(q-value) ≥ 0.1 are plotted (q-value ≤ ~0.79)
        - Multiple mutation types at the same gene are offset horizontally for visibility
        - Significance threshold lines help interpret results:
            * Orange dashed: q = 0.05 (marginally significant)
            * Dark orange dashed: q = 0.01 (significant)  
            * Red dashed: q = 0.001 (highly significant)
    """
    # Default colors
    if colors is None:
        colors = {'gain': '#FF4444', 'loss': '#4444FF', 'mutation': '#44AA44'}
    
    # Extract gene hits data
    gene_hits = grin_results['gene.hits']
    
    # Set up the plot
    fig, ax = plt.subplots(figsize=(12, 6), dpi=110)
    
    # Find which mutation type columns exist and have data
    mutation_cols = []
    for mut_type in ['gain', 'loss', 'mutation']:
        q_col = f'q.nsubj.{mut_type}'
        if q_col in gene_hits.columns:
            mutation_cols.append((mut_type, q_col))
    
    
    # Collect data for each chromosome to calculate cumulative positions
    chrom_data = {}
    cumulative_pos = 0
    
    # Calculate cumulative chromosome positions for plotting
    for _, row in chrom_size.iterrows():
        chrom = row['chrom']
        size = row['size']
        chrom_data[chrom] = {
            'start': cumulative_pos,
            'size': size,
            'center': cumulative_pos + size / 2
        }
        cumulative_pos += size
    
    total_genome_length = cumulative_pos
    
    # Collect all points to plot
    plot_data = {'x': [], 'y': [], 'colors': [], 'types': []}
    
    # Process each gene
    for _, gene_row in gene_hits.iterrows():
        chrom = gene_row['chrom']
        
        # Skip if chromosome not in coordinate map
        if chrom not in chrom_data:
            continue
            
        # Use the gene's chromosome start position directly
        gene_start = gene_row.get('loc.start', 0)
        
        # Map to cumulative genome coordinates for plotting
        x_pos = chrom_data[chrom]['start'] + gene_start
        
        # Add points for each mutation type
        for mut_type, q_col in mutation_cols:
            if q_col not in gene_row or pd.isna(gene_row[q_col]) or gene_row[q_col] <= 0:
                continue
                
            # Convert q-value to -log10(q-value)
            q_value = gene_row[q_col]
            neg_log10_q = -np.log10(q_value)
            
            # Skip if not significant enough to plot
            if neg_log10_q < 0.1:
                continue
            
            # Add slight horizontal offset for multiple mutation types at same gene
            offset_factor = {'gain': -0.3, 'loss': 0, 'mutation': 0.3}
            x_offset = offset_factor.get(mut_type, 0) * (total_genome_length * 0.0001)
            
            plot_data['x'].append(x_pos + x_offset)
            plot_data['y'].append(neg_log10_q)
            plot_data['colors'].append(colors.get(mut_type, '#888888'))
            plot_data['types'].append(mut_type)
    
    
    # Plot each mutation type separately for better legend control
    for mut_type, _ in mutation_cols:
        # Get indices for this mutation type
        indices = [i for i, t in enumerate(plot_data['types']) if t == mut_type]
        
        if indices:
            x_vals = [plot_data['x'][i] for i in indices]
            y_vals = [plot_data['y'][i] for i in indices]
            color = colors.get(mut_type, '#888888')
            
            ax.scatter(x_vals, y_vals, 
                      c=color, 
                      s=8,  # Point size
                      alpha=0.7, 
                      label=mut_type.capitalize(),
                      edgecolors='none')
    
    # Set up axes limits
    ax.set_xlim(0, total_genome_length)
    
    # Calculate y-axis limits from data
    if plot_data['y']:
        max_y = max(plot_data['y']) * 1.1
        ax.set_ylim(0, max(max_y, 5))
    else:
        ax.set_ylim(0, 10)
    
    # Add chromosome separators and labels using the existing logic
    chr_positions = []
    chr_labels = []
    
    for _, row in chrom_size.iterrows():
        chrom = row['chrom']
        
        # Add separator line (except for first chromosome)
        if chrom_data[chrom]['start'] > 0:
            ax.axvline(x=chrom_data[chrom]['start'], color='gray', linewidth=0.5, alpha=0.7)
        
        # Use center position for chromosome label
        chr_positions.append(chrom_data[chrom]['center'])
        chr_labels.append(chrom.replace('chr', ''))
    
    # Set chromosome labels
    ax.set_xticks(chr_positions)
    ax.set_xticklabels(chr_labels, rotation=45, ha='right')
    plt.subplots_adjust(bottom=0.2)

    # Add significance threshold lines
    significance_lines = [
        (1.3, '#FFA500'),  # q=0.05
        (2.0, '#FF6600'),  # q=0.01  
        (3.0, '#FF0000')   # q=0.001
    ]
    
    for threshold, line_color in significance_lines:
        if 0 <= threshold <= ax.get_ylim()[1]:
            ax.axhline(y=threshold, color=line_color, linestyle='--', 
                      linewidth=1, alpha=0.7, zorder=1)
    
    # Labels and title
    ax.set_ylabel('-log₁₀(q-value)', fontsize=12)
    ax.set_xlabel('Chromosomes', fontsize=12) 
    ax.set_title('GRIN2 Analysis - Genome-wide Significance', fontsize=14, pad=20)
    
    # Add legend
    if len(mutation_cols) > 0:
        ax.legend(loc='upper right', frameon=False, fancybox=True, shadow=False,  framealpha=0.0, markerscale=2)
    
    # Clean up the plot
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.grid(True, alpha=0.3, axis='y')
    
    plt.tight_layout()
    return fig

def sort_grin2_data(data):
	"""
	Sort Mutation data based on available p.nsubj columns with priority system
	Priority order:
		1. p.nsubj.mutation (highest priority - if available, always use this)
		2. p.nsubj.gain (medium priority - use if mutation not available)
		3. p.nsubj.loss (lowest priority - use only if neither mutation nor gain available)
	"""
	# Define possible columns in priority order
	possible_cols = ["p.nsubj.mutation", "p.nsubj.gain", "p.nsubj.loss"]
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
def get_sig_values(data):
	"""
	Find all existing p-value columns and return corresponding q-value columns
	Since q-values are guaranteed to exist whenever p-values exist,
	we only need to check for p-value columns and construct the corresponding
	q-value column names.
	"""
	# Define all possible column types to check for
	column_types = ["mutation", "gain", "loss"]
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
    """Smart formatting: scientific notation for very small/large numbers with 4 significant figures"""
    if value == 0:
        return 0
    elif abs(value) < 1e-4 or abs(value) > 1e6:
        return f"{value:.3e}"  # 4 significant figures (3 decimal places in scientific notation)
    else:
        return round(float(value), 6)  # Regular rounding for normal numbers

def simple_column_filter(sorted_results, num_rows_to_process=50):
	"""
	Dynamically generate columns and rows for topGeneTable based on available data
	"""
	result = get_sig_values(sorted_results)
	p_cols = result["p_cols"]
	q_cols = result["q_cols"]
	n_cols = result["n_cols"]
	
	# Check which column groups have data (using your existing p_cols, q_cols, n_cols)
	mutation_has_data = has_data(sorted_results[p_cols[0]]) if p_cols else False
	cnv_gain_has_data = has_data(sorted_results[p_cols[1]]) if len(p_cols) > 1 else False
	cnv_loss_has_data = has_data(sorted_results[p_cols[2]]) if len(p_cols) > 2 else False
	
	# Check CNV data availability
	has_cnv_data = cnv_gain_has_data or cnv_loss_has_data
	has_both_maf_and_cnv = mutation_has_data and has_cnv_data
	
	# Check if constellation columns actually exist
	p3_exists = 'p3.nsubj' in sorted_results.columns
	q3_exists = 'q3.nsubj' in sorted_results.columns
	
	# Sorting logic with fallbacks
	if has_cnv_data and 'p1.nsubj' in sorted_results.columns:
		sorted_results = sorted_results.sort_values('p1.nsubj', ascending=True)
	elif 'p.nsubj.mutation' in sorted_results.columns:
		sorted_results = sorted_results.sort_values('p.nsubj.mutation', ascending=True)
	elif 'p.nsubj.gain' in sorted_results.columns:
		sorted_results = sorted_results.sort_values('p.nsubj.gain', ascending=True)
	else:
		pass

	# Build columns list
	columns = [
		{"label": "Gene", "sortable": True},
		{"label": "Chromosome", "sortable": True}
	]
	if mutation_has_data:
		columns.extend([
			{"label": p_cols[0], "sortable": True},
			{"label": q_cols[0], "sortable": True},
			{"label": n_cols[0], "sortable": True}
		])
	if cnv_gain_has_data:
		columns.extend([
			{"label": p_cols[1], "sortable": True},
			{"label": q_cols[1], "sortable": True},
			{"label": n_cols[1], "sortable": True}
		])
	if cnv_loss_has_data:
		columns.extend([
			{"label": p_cols[2], "sortable": True},
			{"label": q_cols[2], "sortable": True},
			{"label": n_cols[2], "sortable": True}
		])
	
	# Add constellation columns based on what data we have
	if has_cnv_data:
		# Always add p1 and p2 when CNV data is present
		columns.extend([
			{"label": "p1.nsubj", "sortable": True},
			{"label": "q1.nsubj", "sortable": True},
			{"label": "p2.nsubj", "sortable": True},
			{"label": "q2.nsubj", "sortable": True}
		])
		
		# Only add p3/q3 if columns actually exist AND we have both mutation and CNV data
		if has_both_maf_and_cnv and p3_exists and q3_exists:
			columns.extend([
				{"label": "p3.nsubj", "sortable": True},
				{"label": "q3.nsubj", "sortable": True}
			])
	
	# Build rows to match the active columns
	topgene_table_data = []
	for i in range(min(len(sorted_results), num_rows_to_process)):
		row_data = [
			{"value": str(sorted_results.iloc[i]["gene"])},
			{"value": str(sorted_results.iloc[i]["chrom"])}
		]
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
		
		# Add constellation data based on what we have
		if has_cnv_data:
			# Always add p1 and p2 when CNV data is present
			row_data.extend([
				{"value": smart_format(sorted_results.iloc[i]["p1.nsubj"])},
				{"value": smart_format(sorted_results.iloc[i]["q1.nsubj"])},
				{"value": smart_format(sorted_results.iloc[i]["p2.nsubj"])},
				{"value": smart_format(sorted_results.iloc[i]["q2.nsubj"])}
			])
			
			# Only add p3/q3 if columns actually exist AND we have both mutation and CNV data
			if has_both_maf_and_cnv and p3_exists and q3_exists:
				row_data.extend([
					{"value": smart_format(sorted_results.iloc[i]["p3.nsubj"])},
					{"value": smart_format(sorted_results.iloc[i]["q3.nsubj"])}
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
		lesion_df = pd.DataFrame(lesion_data, columns=["ID", "chrom", "loc.start", "loc.end", "lsn.type"])
		lesion_df = lesion_df.astype({
			"ID": str,
			"chrom": str,
			"loc.start": "int64",
			"loc.end": "int64",
			"lsn.type": str
		})
		lesion_df["chrom"] = lesion_df["chrom"].apply(lambda c: f"chr{c}" if not c.startswith("chr") else c)
		lsn_colors = assign_lesion_colors(lesion_df["lsn.type"])
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
	except Exception as e:
		write_error(f"Failed to extract gene.hits or sort grin_table: {str(e)}")
		sys.exit(1)

	# # 6. Generate genomewide plot and encode as Base64
	# try:
	# 	# Create plot
	# 	plt.figure(figsize=(900/110, 600/110), dpi=110)
	# 	plt.margins(0.02)
	# 	genomewide_lsn_plot(
	# 		grin_results,
	# 		max_log10q=150,
	# 		lsn_colors=lsn_colors
	# 	)
	# 	# Save to BytesIO buffer
	# 	buffer = BytesIO()
	# 	plt.savefig(buffer, format="png", bbox_inches="tight")
	# 	plt.close()

	# 	# Get bytes and encode as base64
	# 	buffer.seek(0)
	# 	plot_bytes = buffer.getvalue()
	# 	base64_string = base64.b64encode(plot_bytes).decode("utf-8")
	# except Exception as e:
	# 	write_error(f"Failed to generate genomewide plot: {str(e)}")
	# 	if os.path.exists(temp_file):
	# 		os.remove(temp_file)
	# 	sys.exit(1)
	# finally:
	# 	plt.close("all")

	# 6. Generate Manhattan plot and encode as Base64
	try:
		# Create the Manhattan plot using our new function
		fig = plot_grin2_manhattan(grin_results, chrom_size, lsn_colors)
		
		# Save to BytesIO buffer
		buffer = BytesIO()
		fig.savefig(buffer, format="png", bbox_inches="tight", dpi=110)
		plt.close(fig)

		# Get bytes and encode as base64
		buffer.seek(0)
		plot_bytes = buffer.getvalue()
		base64_string = base64.b64encode(plot_bytes).decode("utf-8")
		
	except Exception as e:
		write_error(f"Failed to generate Manhattan plot: {str(e)}")
		sys.exit(1)
	finally:
		plt.close("all")
		
	# 7. Generate topGeneTable
	max_genes_to_show = 500
	num_rows_to_process = min(len(sorted_results), max_genes_to_show)
	table_result = simple_column_filter(sorted_results, num_rows_to_process)
	columns = table_result["columns"]
	topgene_table_data = table_result["rows"]

	# 8. Prepare response
	grin2_response = {
		"png": [base64_string],
		"topGeneTable": {
			"columns": columns,
			"rows": topgene_table_data
		},
		"totalGenes": len(sorted_results),
		"showingTop": num_rows_to_process
	}

	# Output JSON
	print(json.dumps(grin2_response))
except Exception as e:
	write_error(f"Unexpected error: {str(e)}")
	sys.exit(1)



