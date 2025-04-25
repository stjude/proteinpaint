import type { Svg, SvgG } from '../types/d3'
/**
 * Label Width Calculator for Data Visualizations
 *
 * This utility function calculates the maximum width needed to display text labels
 * in SVG-based data visualizations. It works by temporarily rendering each label
 * to measure its exact width, accounting for font characteristics and actual text content.
 *
 * The function is designed to work with different visualization types (like box plots
 * and violin plots) by providing flexible ways to extract label text from data:
 *
 * 1. Custom Function: You can provide your own function to extract label text
 * 2. Standard Formats: Without a custom function, it automatically handles:
 *    - Box plot data: Uses item.boxplot.label
 *    - Violin plot data: Combines item.label with item.plotValueCount as "label, n=count"
 *    - Simple data: Uses item.label directly
 * Be aware that if the svg is hidden this function will return 0 as getBBox will return 0
 *
 * Example Usage:
 *
 * // With box plot data:
 * const width2 = getMaxLabelWidth(svg, boxPlotData);
 * // Automatically uses boxPlotData[i].boxplot.label
 *
 * // With violin plot data:
 * const width3 = getMaxLabelWidth(svg, violinData);
 * // Automatically formats as "label, n=count"
 *
 * Implementation Details:
 * - Creates a temporary text element for each measurement
 * - Uses the browser's rendering engine for precise width calculation
 * - Removes the temporary element after measurement
 * - Maintains the maximum width seen across all labels
 *
 * @param svg - D3 selection of an SVG element where temporary text elements will be added
 *             for measurement. These elements are immediately removed after measuring.
 *
 * @param items - Array of strings containing label information.
 * @param size - Font size multiplier for labels. Default is 1.
 * @returns The width in pixels of the widest label in the provided items array
 */
export function getMaxLabelWidth(svg: Svg | SvgG, items: string[], size = 1): number {
	let maxLabelLgth = 0
	for (const item of items) {
		// Create temporary text element for measurement
		const label = svg.append('text').text(item).style('font-size', `${size}em`)

		// Update maximum width if current label is wider
		//If the svg is hidden getBBox will return 0 !!!!
		maxLabelLgth = Math.max(maxLabelLgth, label.node()!.getBBox().width)

		// Clean up: remove temporary element
		label.remove()
	}
	return maxLabelLgth
}
