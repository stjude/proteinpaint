/**
 * table.barplot.viz.ts
 *
 * This module provides functionality for rendering barplot visualizations within table cells.
 * It is specifically designed to visualize comparative metrics like Log2 Fold Change (Log2FC)
 * and Normalized Enrichment Scores (NES) in a way that makes their relative magnitudes
 * immediately visible to users.
 *
 * Key features:
 * - Automatic detection of columns that should be rendered as barplots
 * - Symmetric visualization of positive and negative values
 * - Appropriate scaling for different types of metrics
 * - Integration with existing table cell structure
 *
 * @module table.barplot.viz
 */

import { scaleLinear } from 'd3-scale'
import { axisBottom } from 'd3-axis'
import { axisstyle } from '#dom'
import type { Cell, Column } from '../dom/table'

/**
 * Creates a renderer function for generating barplot visualizations within table cells.
 * This function follows the pattern established by getForestPlotter, where we:
 * 1. Calculate scales and ranges once during initialization
 * 2. Return a function that can be used repeatedly to render both headers and data cells
 *
 * The renderer handles two distinct cases:
 * - Header cells: Renders the column label and an axis showing the value range
 * - Data cells: Renders a bar representing the numeric value
 *
 * @param rows - Array of cell data from which to calculate value ranges
 * @param column - Column configuration including any barplot-specific settings
 * @returns A function that can render either a header or data cell
 *
 * Visual Design Principles:
 * - Bars extend left (blue) for negative values and right (red) for positive values
 * - A central vertical line marks the zero point
 * - Value labels are positioned outside the bars for better readability
 * - Header shows a scale appropriate to the data range
 */

export function getBarplotRenderer(rows: Cell[], column: Column) {
	// First collect all numeric values from this column
	const values = rows
		.map(cell => (typeof cell === 'object' ? cell.value : cell))
		.filter((v): v is number => typeof v === 'number' && !isNaN(v))

	if (values.length === 0) {
		// Return empty function if no valid values
		return () => {}
	}

	// Calculate the range
	let minValue = Math.min(...values)
	let maxValue = Math.max(...values)

	// If a minimum range is specified in the column config, use it
	if (column.barplot?.minimumRange) {
		minValue = Math.min(minValue, column.barplot.minimumRange[0])
		maxValue = Math.max(maxValue, column.barplot.minimumRange[1])
	}

	// Set up dimensions
	const width = column.barplot?.axisWidth || 100
	const height = 20
	const padding = {
		top: 20,
		bottom: 5,
		left: 35,
		right: 35,
		text: 8
	}

	// Calculate total required width for the cell
	const totalWidth = width + padding.left + padding.right

	// Create the scale that will be used for both axis and bars
	const scale = scaleLinear().domain([minValue, maxValue]).range([0, width]).nice()

	/**
	 * The returned function can create either:
	 * - An axis (when called with just td)
	 * - A bar (when called with td and value)
	 */
	return (td: any, value?: number) => {
		const svg = td
			.append('svg')
			.attr('width', width + padding.left + padding.right)
			.attr('height', height + padding.top + padding.bottom)

		const g = svg.append('g').attr('transform', `translate(${padding.left},${padding.top})`)

		if (value === undefined) {
			// Render the axis below the title
			const axis = axisBottom(scale).scale(scale).ticks(5)

			// Add and style the axis
			const axisG = g.append('g').attr('transform', `translate(0,${height})`).call(axis)

			// Style axis lines and text
			axisstyle({
				axis: axisG,
				color: '#666',
				showline: true
			})

			// Add label below axis
			td.append('div').style('text-align', 'center').style('margin-top', '5px').text(column.label)
		} else {
			// Create bar visualization for a cell
			if (isNaN(value)) {
				td.text('NA')
				return
			}

			// Calculate bar dimensions
			const zeroX = scale(0)
			const valueX = scale(value)
			const barWidth = Math.abs(valueX - zeroX)
			const barX = value < 0 ? valueX : zeroX

			// Draw zero reference line
			g.append('line')
				.attr('x1', zeroX)
				.attr('x2', zeroX)
				.attr('y1', 0)
				.attr('y2', height)
				.attr('stroke', '#ccc')
				.attr('stroke-width', 1)

			// Draw the bar
			g.append('rect')
				.attr('x', barX)
				.attr('y', 0)
				.attr('width', barWidth)
				.attr('height', height)
				.attr(
					'fill',
					value < 0
						? column.barplot?.colorNegative || '#2E6594' // Blue for negative
						: column.barplot?.colorPositive || '#dc3545'
				) // Red for positive

			// Add value label
			const textPadding = 5 // Adjust this value to control the amount of padding
			g.append('text')
				.attr('x', valueX + (value < 0 ? -textPadding : textPadding)) // Add padding in appropriate direction
				.attr('y', height / 2)
				.attr('dy', '0.35em')
				.attr('text-anchor', value < 0 ? 'end' : 'start')
				.attr('fill', '#666')
				.attr('font-size', '12px')
				.text(value.toFixed(2))
		}
	}
}

/**
 * Determines whether a column should be rendered as a barplot.
 * This function identifies columns that represent comparative metrics
 * while explicitly excluding columns that are simple numeric counts.
 *
 * The function uses a two-step process:
 * 1. First checks if the column is explicitly configured for barplot
 * 2. Then checks the column label against known metric types
 *
 * @param column - The column configuration object
 * @returns boolean indicating whether the column should be rendered as a barplot
 */

export function shouldBeBarplot(column: Column): boolean {
	// If barplot configuration is explicitly set, use that
	if (column.barplot !== undefined) {
		return true
	}

	// Clean up the label by converting to lowercase and removing extra spaces
	const label = column.label.toLowerCase().trim()

	// Create a specific list of columns that should be barplots
	const barplotColumns = ['log2fc', 'normalized enrichment score', 'nes']

	// Columns that should not be barplots even though they contain numbers
	const excludedNumericColumns = ['geneset size', 'size', 'count', 'number of genes', 'gene count']

	// First check if it's in the excluded list
	if (excludedNumericColumns.some(name => label.includes(name))) {
		return false
	}

	// Then check if it's in the barplot list
	return barplotColumns.some(name => label.includes(name))
}
