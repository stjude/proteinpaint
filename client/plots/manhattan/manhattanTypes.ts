/**
 * Represents a single data point in a Manhattan plot.
 * Each point corresponds to a gene.
 *
 * @interface ManhattanPoint
 *
 * @property {string} chrom - Chromosome identifier (e.g., 'chr1', 'chr2', 'chrX')
 * @property {string} color - Display color for the point (e.g. data type)
 * @property {number} end - Genomic end position (1-based coordinate)
 * @property {string} gene - Gene symbol or identifier associated with this variant
 * @property {number} nsubj - Number of subjects/samples included in the analysis for this variant
 * @property {number} pixel_x - X-axis pixel coordinate for rendering in the plot
 * @property {number} pixel_y - Y-axis pixel coordinate for rendering in the plot
 * @property {number} pos - Genomic position (typically the variant position or region midpoint)
 * @property {number} q_value - False discovery rate adjusted p-value (q-value)
 * @property {number} start - Genomic start position (1-based coordinate)
 * @property {string} type - Type or category of the variant/association (e.g., 'snv', 'cnv', 'fusion')
 * @property {number} x - Genome-wide position
 * @property {number} y - Y-axis value, -log₁₀(q-value) for significance
 */
export interface ManhattanPoint {
	chrom: string
	color: string
	end: number
	gene: string
	nsubj: number
	pixel_x: number
	pixel_y: number
	pos: number
	q_value: number
	start: number
	type: string
	x: number
	y: number
}
