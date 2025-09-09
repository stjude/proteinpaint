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
#  lesion: JSON string containing array of lesion data from gdcGRIN2.rs
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
                        colors: Optional[Dict[str, str]] = None,
                        plot_width: int = 1000,
                        plot_height: int = 400,
                        device_pixel_ratio: float = 2.0,
                        png_dot_radius: int = 2,
                        correction_strength: float = 0.06) -> tuple[plt.Figure, dict]:
	
    """
    Create a Manhattan plot for GRIN2 genomic analysis results using colored scatter points.
    
    This function generates a genome-wide visualization showing the statistical 
    significance of genomic alterations across all chromosomes. Each point represents 
    a gene with its significance level (-log₁₀(q-value)) plotted against its chromosome
    start position. Different mutation types (gain, loss, mutation) are shown in different colors.
    
    Args:
	    grin_results (dict): Results dictionary from grin_stats() function containing:
            - 'gene.hits': DataFrame with gene-level statistical results
        chrom_size (pd.DataFrame): Chromosome size information with columns:
            - 'chrom': Chromosome names
            - 'size': Chromosome lengths in base pairs
        colors (Optional[Dict[str, str]]): Color mapping for mutation types.
        plot_width (int): Desired plot width in pixels.
        plot_height (int): Desired plot height in pixels.
        device_pixel_ratio (float): Device pixel ratio for rendering.
        correction_strength (float): Strength of the radial correction term. 
                                   Positive values pull points toward center.
                                   Typical values: 0.005 to 0.06
	Returns:
        tuple[plt.Figure, dict]: Matplotlib figure and interactive data dictionary

    """
    # Set default colors if not provided
    if colors is None:
        colors = {
            'gain': '#FF4444',
            'loss': '#4444FF', 
            'mutation': '#44AA44'
        }

    # Calculate PNG dimensions with padding for dot radius
    png_width = plot_width + 2 * png_dot_radius
    png_height = plot_height + 2 * png_dot_radius

    # Calculate DPI and figure size based on PNG dimensions
    base_dpi = 100
    plot_dpi = int(base_dpi * device_pixel_ratio)
    fig_width_inches = png_width / base_dpi
    fig_height_inches = png_height / base_dpi
    
    # Extract gene.hits data
    gene_hits = grin_results['gene.hits']
    
    # Find which mutation types have data
    mutation_cols = []
    for mut_type in ['gain', 'loss', 'mutation']:
        q_col = f'q.nsubj.{mut_type}'
        if q_col in gene_hits.columns:
            mutation_cols.append((mut_type, q_col))
    
    # Calculate cumulative chromosome positions
    chrom_data = {}
    cumulative_pos = 0
    
    for chrom_index, (_, row) in enumerate(chrom_size.iterrows()):
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
    plot_data = {'x': [], 'y': [], 'colors': [], 'types': [], 'nsubj.mutation': [], 'nsubj.gain': [], 'nsubj.loss': []}
    point_details = []
    
    # Process each gene
    for _, gene_row in gene_hits.iterrows():
        chrom = gene_row['chrom']
        gene_name = gene_row.get('gene', 'Unknown') 
        
        if chrom not in chrom_data:
            continue
            
        gene_start = gene_row.get('loc.start', 0)
        x_pos = chrom_data[chrom]['start'] + gene_start
        
        # Add points for each mutation type
        for mut_type, q_col in mutation_cols:
            if q_col not in gene_row or pd.isna(gene_row[q_col]) or gene_row[q_col] <= 0:
                continue

            q_value = gene_row[q_col]
            neg_log10_q = -np.log10(q_value)
            n_subj_count = gene_row.get(f'nsubj.{mut_type}', None)
            
            # Add horizontal offset for multiple mutation types
            offset_factor = {'gain': -0.3, 'loss': 0, 'mutation': 0.3}
            x_offset = offset_factor.get(mut_type, 0) * (total_genome_length * 0.0001)
            
            final_x = x_pos + x_offset
            color = colors.get(mut_type, '#888888')
            
            # Add ALL points to plot_data
            plot_data['x'].append(final_x)
            plot_data['y'].append(neg_log10_q)
            plot_data['colors'].append(color)
            plot_data['types'].append(mut_type)
            plot_data['nsubj.mutation'].append(n_subj_count if mut_type == 'mutation' else None)
            plot_data['nsubj.gain'].append(n_subj_count if mut_type == 'gain' else None)
            plot_data['nsubj.loss'].append(n_subj_count if mut_type == 'loss' else None)

            # Only add significant points for interactivity
            if q_value <= 0.05:
                point_details.append({
                    'x': final_x,
                    'y': neg_log10_q,
                    'color': color,
                    'type': mut_type,
                    'gene': gene_name,
                    'chrom': chrom,
                    'pos': gene_start,
                    'q_value': q_value,
                    'nsubj': n_subj_count
                })
    
    # Create matplotlib figure
    fig, ax = plt.subplots(1, 1, figsize=(fig_width_inches, fig_height_inches), dpi=plot_dpi)

    # Calculate y-axis limits
    y_axis_scaled = False
    scale_factor_y = 1.0
    y_min = 0
    y_max = 5  # default
    
    if plot_data['y']:
        max_y = max(plot_data['y'])
        
        # Scale for very high values
        if max_y > 40:
            target_max = 40
            scale_factor_y = target_max / max_y
            plot_data['y'] = [y * scale_factor_y for y in plot_data['y']]
            for point in point_details:
                point['y'] *= scale_factor_y
            scaled_max = max(plot_data['y'])
            y_max = scaled_max + 0.15
            y_axis_scaled = True
        else:
            y_max = max(max_y + 0.15, 5)

    # Calculate center points for correction
    plot_center_x = plot_width / 2
    plot_center_y = plot_height / 2

    # Create D3-compatible linear scales with radial correction
    def x_scale_func(x):
        return (x / total_genome_length) * plot_width
    
    def y_scale_func(y):
        return ((y_max - y) / y_max) * plot_height
    
    def apply_radial_correction(x_pixel, y_pixel):
        """Apply radial correction to pull points toward center"""
        # Calculate distance from center
        dx = x_pixel - plot_center_x
        dy = y_pixel - plot_center_y
        
        # Apply correction proportional to distance from center
        corrected_x = x_pixel - (dx * correction_strength)
        corrected_y = y_pixel - (dy * correction_strength)
        
        return corrected_x, corrected_y
    
    # Convert point details to SVG coordinates with correction
    for point in point_details:
        base_x = x_scale_func(point['x'])
        base_y = y_scale_func(point['y'])
        
        # Apply radial correction
        corrected_x, corrected_y = apply_radial_correction(base_x, base_y)
        
        point['svg_x'] = int(round(corrected_x))
        point['svg_y'] = int(round(corrected_y))
        
        # Clamp to plot boundaries
        point['svg_x'] = max(0, min(plot_width, point['svg_x']))
        point['svg_y'] = max(0, min(plot_height, point['svg_y']))

    # Convert coordinates for matplotlib (add padding and flip Y back)
    pixel_plot_data = {
        'x': [x_scale_func(x) + png_dot_radius for x in plot_data['x']],
        'y': [plot_height - y_scale_func(y) + png_dot_radius for y in plot_data['y']],
        'colors': plot_data['colors']
    }

    # Set matplotlib to use pixel coordinates
    ax.set_xlim(0, png_width)
    ax.set_ylim(0, png_height)

    # Create alternating chromosome backgrounds
    for i, (_, row) in enumerate(chrom_size.iterrows()):
        chrom = row['chrom']
        if chrom in chrom_data:
            start_pos = x_scale_func(chrom_data[chrom]['start']) + png_dot_radius
            end_pos = x_scale_func(chrom_data[chrom]['start'] + chrom_data[chrom]['size']) + png_dot_radius
            
            # Alternate between light and slightly darker gray
            if i % 2 == 0:
                ax.axvspan(start_pos, end_pos, facecolor='#FFFFFF', alpha=0.5, zorder=0)
            else:
                ax.axvspan(start_pos, end_pos, facecolor='#D3D3D3', alpha=0.5, zorder=0)

    # Plot data points using pixel coordinates
    if pixel_plot_data['x']:
        point_size = (png_dot_radius * 2) ** 2
        ax.scatter(pixel_plot_data['x'], pixel_plot_data['y'], c=pixel_plot_data['colors'], 
                   s=point_size, alpha=0.7, edgecolors='none', zorder=2)

    # Remove axes, labels, and ticks
    ax.set_xticks([])
    ax.set_yticks([])
    ax.set_xlabel('')
    ax.set_ylabel('')
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['bottom'].set_visible(False)
    ax.spines['left'].set_visible(False)
    
    # Remove all margins
    plt.subplots_adjust(left=0, right=1, top=1, bottom=0)

    fig.canvas.draw()

    # Return interactive data including correction strength for client-side tuning
    interactive_data = {
        'points': point_details,
        'chrom_data': chrom_data,
        'y_axis_scaled': y_axis_scaled,
        'scale_factor': scale_factor_y,
        'total_genome_length': total_genome_length,
        'y_min': y_min,
        'y_max': y_max,
        'plot_width': plot_width,
        'plot_height': plot_height,
        'png_width': png_width,
        'png_height': png_height,
        'device_pixel_ratio': device_pixel_ratio,
        'dpi': plot_dpi,
        'png_dot_radius': png_dot_radius,
        'correction_strength': correction_strength
    }
    
    return fig, interactive_data

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
    """Format to 4 significant digits but keep as numbers for proper sorting"""
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
	except Exception as e:
		write_error(f"Failed to extract gene.hits or sort grin_table: {str(e)}")
		sys.exit(1)


	# 6. Generate Manhattan plot and encode as Base64

	# Get parameters from input, with defaults
	device_pixel_ratio = input_data.get("devicePixelRatio", 2.0)
	plot_width = input_data.get("width", 1000)
	plot_height = input_data.get("height", 400)
	png_dot_radius = input_data.get("pngDotRadius", 2)

	try:
		# Create the Manhattan plot
		fig, plot_data = plot_grin2_manhattan(
			grin_results, 
			chrom_size, 
			lsn_colors,
			plot_width,
			plot_height,
			device_pixel_ratio,
			png_dot_radius
		)

		# Save to BytesIO buffer - use the DPI from the plot_data
		save_dpi = plot_data['dpi']
		
		buffer = BytesIO()
		fig.savefig(buffer, format="png", bbox_inches="tight", dpi=save_dpi)
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
		"plotData": plot_data,
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