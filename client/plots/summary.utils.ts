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
 *
 * Example Usage:
 *
 * // With custom label extraction:
 * const width1 = getMaxLabelWidth(svg, data, item => `${item.category}: ${item.value}`);
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
 * @param items - Array of data items containing label information. The structure of these
 *               items can vary based on the visualization type (box plot, violin plot, etc.).
 *               Each item should either have a label accessible via the provided getLabelText
 *               function, or follow one of the standard formats.
 *
 * @param getLabelText - Optional function to extract label text from each item. If not provided,
 *                      the function will attempt to handle common data formats:
 *                      - For box plots: item.boxplot.label
 *                      - For violin plots: "item.label, n=item.plotValueCount"
 *                      - For simple items: item.label
 *
 * @returns The width in pixels of the widest label in the provided items array
 *
 * @throws Will throw an error if the SVG selection is invalid or if label text
 *         cannot be extracted from an item when no getLabelText function is provided
 */
export function getMaxLabelWidth<T extends object>(
	svg: d3.Selection<any, any, any, any>,
	items: T[],
	getLabelText?: (item: T) => string
): number {
	let maxLabelLgth = 0

	for (const item of items) {
		// If no getLabelText function is provided, try to use standard formats
		const text = getLabelText
			? getLabelText(item)
			: 'boxplot' in item
			? (item as any).boxplot.label
			: `${(item as any).label}${(item as any).plotValueCount ? `, n=${(item as any).plotValueCount}` : ''}`

		// Create temporary text element for measurement
		const label = svg.append('text').text(text)

		// Update maximum width if current label is wider
		maxLabelLgth = Math.max(maxLabelLgth, label.node()!.getBBox().width)

		// Clean up: remove temporary element
		label.remove()
	}
	return maxLabelLgth
}
