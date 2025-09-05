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
                        device_pixel_ratio: float = 2.0) -> tuple[plt.Figure, dict]:
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
        device_pixel_ratio (float): Device pixel ratio for rendering.

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

    scale_factor = device_pixel_ratio * 0.7
    base_width = 10 / scale_factor
    base_height = 5 / scale_factor

    # Set plot DPI - use device pixel ratio
    plot_dpi = int(110 * min(device_pixel_ratio, 2.5))
    
    # Extract gene.hits data
    gene_hits = grin_results['gene.hits']
    
    # Find which mutation types have data
    mutation_cols = []
    for mut_type in ['gain', 'loss', 'mutation']:
        q_col = f'q.nsubj.{mut_type}'
        if q_col in gene_hits.columns:
            mutation_cols.append((mut_type, q_col))
    
    # Collect data for each chromosome to calculate cumulative positions
    chrom_data = {}
    cumulative_pos = 0
    
    # Calculate cumulative chromosome positions for plotting
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
    
    # Collect all points to plot (for PNG)
    plot_data = {'x': [], 'y': [], 'colors': [], 'types': []}
    point_details = []  # Only significant points for interactivity
    
    # Process each gene
    for _, gene_row in gene_hits.iterrows():
        chrom = gene_row['chrom']
        gene_name = gene_row.get('gene', 'Unknown') 
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

            q_value = gene_row[q_col]
            
            # Convert q-value to -log10(q-value)
            neg_log10_q = -np.log10(q_value)
            
            # Add slight horizontal offset for multiple mutation types at same gene
            offset_factor = {'gain': -0.3, 'loss': 0, 'mutation': 0.3}
            x_offset = offset_factor.get(mut_type, 0) * (total_genome_length * 0.0001)
            
            final_x = x_pos + x_offset
            color = colors.get(mut_type, '#888888')
            
            # Add ALL points to plot_data (for PNG visualization)
            plot_data['x'].append(final_x)
            plot_data['y'].append(neg_log10_q)
            plot_data['colors'].append(color)
            plot_data['types'].append(mut_type)
            
            # Only add significant points (q <= 0.05) to interactive data
            if q_value <= 0.05:
                point_details.append({
                    'x': final_x,
                    'y': neg_log10_q,
                    'color': color,
                    'type': mut_type,
                    'gene': gene_name,
                    'chrom': chrom,
                    'pos': gene_start,
                    'q_value': q_value
                })
    
    # Create the matplotlib figure with scaled dimensions
    fig, ax = plt.subplots(1, 1, figsize=(base_width, base_height), dpi=plot_dpi)
    
    # Set up axes limits
    ax.set_xlim(0, total_genome_length)
    
    # Calculate y-axis limits from data with optional scaling for very high values
    y_axis_scaled = False
    scale_factor_y = 1.0
    if plot_data['y']:
        max_y = max(plot_data['y'])
        
        # If we have extremely high significance values, scale them down for better visualization
        if max_y > 40:
            # Scale all y-values so the maximum becomes 40
            target_max = 40
            scale_factor_y = target_max / max_y
            plot_data['y'] = [y * scale_factor_y for y in plot_data['y']]
            # Also update point_details
            for point in point_details:
                point['y'] *= scale_factor_y
            scaled_max = max(plot_data['y'])
            ax.set_ylim(0, scaled_max + 0.15)  # Add a small margin so points don't get clipped
            y_axis_scaled = True
        else:
            # Normal case
            ax.set_ylim(0, max(max_y + 0.15, 5))
    else:
        # No data points to plot
        ax.set_ylim(0, 5)

    # Create alternating pattern based on chromosome order
    for i, (_, row) in enumerate(chrom_size.iterrows()):
        chrom = row['chrom']
        if chrom in chrom_data:
            start_pos = chrom_data[chrom]['start']
            end_pos = start_pos + chrom_data[chrom]['size']
            
            # Alternate between light and slightly darker gray
            if i % 2 == 0:
                ax.axvspan(start_pos, end_pos, facecolor='#f0f0f0', alpha=0.5, zorder=0)
            else:
                ax.axvspan(start_pos, end_pos, facecolor='#e0e0e0', alpha=0.5, zorder=0)
    
    # Plot the data points
    if plot_data['x']:
        ax.scatter(plot_data['x'], plot_data['y'], c=plot_data['colors'], 
                   s=20, alpha=0.7, edgecolors='none', zorder=2)
    
    # Set chromosome positions and labels
    chr_positions = [chrom_data[row['chrom']]['center'] for _, row in chrom_size.iterrows() 
                     if row['chrom'] in chrom_data]
    chr_labels = [row['chrom'].replace('chr', '') for _, row in chrom_size.iterrows() 
                  if row['chrom'] in chrom_data]
    
    # Set chromosome labels
    ax.set_xticks(chr_positions)
    ax.set_xticklabels(chr_labels, rotation=45, ha='center', va='top')
    ax.tick_params(axis='x', pad=2)

    # Labels and title
    ax.set_ylabel('-log₁₀(q-value)', fontsize=12)
    ax.set_xlabel('Chromosomes', fontsize=12) 
    ax.set_title('Genome-Wide Significance', fontsize=14, pad=20, loc='left')

    # Add horizontal legend at the top right, same level as title
    if len(mutation_cols) > 0:
        # Create legend labels
        legend_labels = [mut_type.capitalize() for mut_type, _ in mutation_cols]
        
        # Add scaling note to legend if y-axis was scaled
        if y_axis_scaled:
            legend_labels.append("Y-axis capped at 40")
        
        # Create legend handles using scatter plot markers (no lines)
        legend_handles = []
        for mut_type, _ in mutation_cols:
            color = colors.get(mut_type, '#888888')
            legend_handles.append(plt.Line2D([0], [0], marker='o', color='w', 
                                           markerfacecolor=color, markersize=8, alpha=0.7,
                                           linestyle='None'))  # Explicitly no line
        
        # Add empty handle for scaling note if needed (with small marker)
        if y_axis_scaled:
            legend_handles.append(plt.Line2D([0], [0], marker='*', color='w', 
                                           markerfacecolor='gray', markersize=6, alpha=0.7,
                                           linestyle='None'))
        
        # Position legend horizontally at top right
        ax.legend(legend_handles, legend_labels, 
                 bbox_to_anchor=(1.0, 0.98), loc='lower right', 
                 ncol=len(legend_labels), frameon=False, 
                 fancybox=False, shadow=False, framealpha=0.0)
    
    # Clean up the plot
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.grid(True, alpha=0.3, axis='y')
    
    plt.tight_layout()

    fig.canvas.draw()  # Ensure rendering is complete for interactive features

    # Get exact figure dimensions in pixels (this matches what's saved as PNG)
    bbox = fig.get_window_extent().transformed(fig.dpi_scale_trans.inverted())
    width_inches, height_inches = bbox.width, bbox.height
    width_pixels = int(width_inches * plot_dpi)
    height_pixels = int(height_inches * plot_dpi)

    # Transform coordinates only for significant points
    if len(point_details) > 0:
        plot_coords = np.array([[point['x'], point['y']] for point in point_details])
        
        pixel_coords = ax.transData.transform(plot_coords)
        
        # Get the figure and axis bounding boxes in display coordinates
        fig_bbox = fig.get_window_extent()
        ax_bbox = ax.get_window_extent()
        
        # Calculate scaling factors from display to PNG pixels
        scale_x = width_pixels / fig_bbox.width
        scale_y = height_pixels / fig_bbox.height
        
        # Position-dependent offset correction for perspective distortion
        plot_center_x = width_pixels / 2
        
        # Transform coordinates to PNG pixel space
        for i, point in enumerate(point_details):
            px, py = pixel_coords[i]
            
            # Calculate base pixel position
            base_x = px * scale_x
            base_y = height_pixels - (py * scale_y)
            
            # Position-dependent offset: negative on left, positive on right
            # Adjust the multiplier (0.010) to control correction strength
            distance_from_center = base_x - plot_center_x
            position_offset = distance_from_center * 0.010  # Try values 0.005-0.015
            
            # Apply the position-dependent correction
            svg_x = int(round(base_x + position_offset))
            svg_y = int(round(base_y))
            
            point['svg_x'] = max(0, min(width_pixels, svg_x))  # Clamp to image bounds
            point['svg_y'] = max(0, min(height_pixels, svg_y))

    # Update interactive_data with corrected dimensions
    interactive_data = {
        'points': point_details,
        'chrom_data': chrom_data,
        'y_axis_scaled': y_axis_scaled,
        'scale_factor': scale_factor_y,
        'total_genome_length': total_genome_length,
        'plot_width': width_pixels,
        'plot_height': height_pixels,
        'dpi': plot_dpi
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

	# Get device pixel ratio or set to 2 if not provided	
	device_pixel_ratio = input_data.get("devicePixelRatio", 2.0)
	try:

		# Create the Manhattan plot
		fig, plot_data = plot_grin2_manhattan(
		grin_results, 
		chrom_size, 
		lsn_colors,
		device_pixel_ratio
	)

		# Calculate DPI for saving (same as used in plotting)
		base_dpi = 110
		save_dpi = int(base_dpi * device_pixel_ratio)
		
		# Save to BytesIO buffer
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
	