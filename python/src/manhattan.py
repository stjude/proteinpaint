import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib as mpl
from typing import Optional, Dict

def plot_manhattan(grin_results: dict, 
                        chrom_size: pd.DataFrame,
                        colors: Optional[Dict[str, str]] = None,
                        plot_width: int = 1000,
                        plot_height: int = 400,
                        device_pixel_ratio: float = 2.0,
                        png_dot_radius: int = 2) -> tuple[plt.Figure, dict]:
    """
    Create a Manhattan plot for different kinds of analysis results using colored scatter points.
    
    This function generates a genome-wide visualization showing the statistical 
    significance of genomic alterations across all chromosomes. Each point represents 
    a gene with its significance level (-log₁₀(q-value)) plotted against its chromosome
    start position. Different mutation types (gain, loss, mutation) are shown in different colors.
    
    Args:
        analysis_results (dict): Results dictionary from some analysis such as grin_stats() function containing:
            - 'gene.hits': DataFrame with gene-level statistical results
        chrom_size (pd.DataFrame): Chromosome size information with columns:
            - 'chrom': Chromosome names
            - 'size': Chromosome lengths in base pairs
        colors (Optional[Dict[str, str]]): Color mapping for mutation types.
        plot_width (int): Desired plot width in pixels.
        plot_height (int): Desired plot height in pixels.
		png_dot_radius (int): Radius of dots in the PNG output.
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

    # Calculate PNG dimensions with padding for dot radius
    png_width = plot_width + 2 * png_dot_radius
    png_height = plot_height + 2 * png_dot_radius

	# Set up matplotlib margins to 0
    plt.rcParams['figure.subplot.left'] = 0
    plt.rcParams['figure.subplot.right'] = 1
    plt.rcParams['figure.subplot.top'] = 1
    plt.rcParams['figure.subplot.bottom'] = 0
    plt.rcParams['axes.xmargin'] = 0
    plt.rcParams['axes.ymargin'] = 0

    # Calculate DPI and figure size based on PNG dimensions
    base_dpi = 100
    plot_dpi = int(base_dpi * device_pixel_ratio)
    fig_width = png_width / base_dpi
    fig_height = png_height / base_dpi
    
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
            
            color = colors.get(mut_type, '#888888')
            
            # Add ALL points to plot_data for PNG generation
            plot_data['x'].append(x_pos)
            plot_data['y'].append(neg_log10_q)
            plot_data['colors'].append(color)
            plot_data['types'].append(mut_type)

            # Only add significant points for interactivity - store raw coordinates
            if q_value <= 0.05:
                point_details.append({
                    'x': x_pos,  # Raw genomic coordinate
                    'y': neg_log10_q,  # Raw -log10(q-value)
                    'color': color,
                    'type': mut_type,
                    'gene': gene_name,
                    'chrom': chrom,
                    'pos': gene_start,
                    'q_value': q_value,
                    'nsubj': n_subj_count
                })
    
    # Create matplotlib figure
    fig, ax = plt.subplots(1, 1, figsize=(fig_width, fig_height), dpi=plot_dpi)
    ax.set_position([0, 0, 1, 1])

    # Calculate y-axis limits
    y_axis_scaled = False
    scale_factor_y = 1.0
    y_min = 0

	# Calculate x-axis buffer as percentage of total genome length
    x_buffer = total_genome_length * 0.010  # 1.0% buffer on each side

	# Calculate y-axis buffer as percentage of total png height
    y_buffer = png_height * 0.0012  # 0.12% buffer above and below
    
    if plot_data['y']:
        max_y = max(plot_data['y'])
        
        # Scale for very high values
        if max_y > 40:
            target_max = 40
            scale_factor_y = target_max / max_y
            plot_data['y'] = [y * scale_factor_y for y in plot_data['y']]
            # Also scale point_details for consistency
            for point in point_details:
                point['y'] *= scale_factor_y
            scaled_max = max(plot_data['y'])
            y_max = scaled_max
            y_axis_scaled = True
        else:
            y_max = max_y

    # Set matplotlib to use raw genomic coordinates
    ax.set_xlim(-x_buffer, total_genome_length + x_buffer)
    ax.set_ylim(-y_buffer, y_max + y_buffer)

    # Create alternating chromosome backgrounds
    for i, (_, row) in enumerate(chrom_size.iterrows()):
        chrom = row['chrom']
        if chrom in chrom_data:
            start_pos = chrom_data[chrom]['start']
            end_pos = chrom_data[chrom]['start'] + chrom_data[chrom]['size']
            
            # Alternate between light and slightly darker gray
            if i % 2 == 0:
                ax.axvspan(start_pos, end_pos, facecolor='#FFFFFF', alpha=0.5, zorder=0)
            else:
                ax.axvspan(start_pos, end_pos, facecolor='#D3D3D3', alpha=0.5, zorder=0)

    # Plot data points using raw coordinates
    if plot_data['x']:
        point_size = png_dot_radius * 3 ** 2 
        ax.scatter(plot_data['x'], plot_data['y'], c=plot_data['colors'], 
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

    # Return raw coordinates and scale info for client-side D3 handling
    interactive_data = {
        'points': point_details,  # Raw genomic x, raw -log10(q) y coordinates
        'chrom_data': chrom_data,
        'y_axis_scaled': y_axis_scaled,
        'scale_factor': scale_factor_y,
        'total_genome_length': total_genome_length,
        'x_buffer': x_buffer,
        'y_buffer': y_buffer,
        'y_min': y_min,
        'y_max': y_max,
        'plot_width': plot_width,
        'plot_height': plot_height,
        'png_width': png_width,
        'png_height': png_height,
        'device_pixel_ratio': device_pixel_ratio,
        'dpi': plot_dpi,
        'png_dot_radius': png_dot_radius
    }
    
    return fig, interactive_data
