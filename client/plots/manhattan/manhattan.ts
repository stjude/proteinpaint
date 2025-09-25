import { scaleLinear } from 'd3-scale'
import * as d3axis from 'd3-axis'
import { Menu, table2col, icons } from '#dom'
import { to_svg } from '#src/client'

/**
 * Creates an interactive Manhattan plot on top of a PNG background plot image.
 *
 * @param {Object} div - div element to contain the plot
 * @param {Object} data - Plot data
 * @param {Object} settings - Display configuration options:
 *   @param {number} [settings.plotWidth=1000] - Plot area width
 *   @param {number} [settings.plotHeight=400] - Plot area height
 *   @param {boolean} [settings.showLegend=true] - Whether to display legend
 *   @param {boolean} [settings.showDownload=true] - Whether to show download button
 *   @param {boolean} [settings.showInteractiveDots=true] - Whether to show hoverable data points
 *   @param {number} [settings.yAxisX=70] - Y-axis positioning
 *   @param {number} [settings.yAxisSpace=40] - Space between Y-axis and plot
 *   @param {number} [settings.yAxisY=40] - Top margin
 *   @param {number} [settings.chromLabelBuffer=20] - Buffer space for chromosome labels
 *   @param {number} [settings.xAxisTitleBuffer=45] - Buffer space for x-axis title
 *   @param {number} [settings.fontSize=12] - Base font size
 *   @param {number} [settings.pngDotRadius=2] - Radius of dots in PNG plot
 *   @param {number} [settings.legendItemWidth=80] - Horizontal space per legend item
 *   @param {number} [settings.legendDotRadius=3] - Size of legend dots
 *   @param {number} [settings.legendRightOffset=15] - Offset from right edge
 *   @param {number} [settings.legendTextOffset=12] - Distance between dot and text
 *   @param {number} [settings.legendVerticalOffset=4] - Vertical offset for legend items
 *   @param {number} [settings.legendFontSize=12] - Font size for legend text
 *   @param {number} [settings.interactiveDotRadius=3] - Radius of interactive dots
 *   @param {number} [settings.interactiveDotStrokeWidth=1] - Stroke width for interactive dots
 * @param {Object} [app] - Optional app context for dispatching events
 *
 * @description
 * Renders a genomic Manhattan plot by overlaying interactive elements on the base PNG plot image.
 * Features include chromosome labels, legend, hoverable data points with tooltips,
 * and proper axis scaling. The plot combines a static PNG plot image of all points with dynamic SVG elements
 * including axes, labels, legend, and top genes (represented as interactive dots) for detailed information on hover.
 */

export function plotManhattan(div: any, data: any, settings: any, app?: any) {
	// Default settings
	settings = {
		pngDotRadius: 2,
		plotWidth: 1000,
		plotHeight: 400,
		showDownload: true,
		yAxisX: 70,
		yAxisY: 40,
		yAxisSpace: 40,
		chromLabelBuffer: 20,
		xAxisTitleBuffer: 45,
		fontSize: 12,
		showLegend: true,
		legendItemWidth: 80,
		legendDotRadius: 3,
		legendRightOffset: 15,
		legendTextOffset: 12,
		legendVerticalOffset: 4,
		legendFontSize: 12,
		showInteractiveDots: true,
		interactiveDotRadius: 3,
		interactiveDotStrokeWidth: 1,
		...settings
	}

	// Set relative positioning on the main div for positioning of download button
	div.style('position', 'relative')

	// Create tooltip menu
	const geneTip = new Menu({ padding: '' })

	const svg = div
		.append('svg')
		.attr('width', data.plotData.png_width + settings.yAxisX + settings.yAxisSpace)
		.attr(
			'height',
			data.plotData.png_height +
				settings.yAxisY +
				settings.xAxisTitleBuffer +
				settings.legendVerticalOffset +
				settings.chromLabelBuffer
		)

	const { plot_width, plot_height, x_domain, y_domain, interactive_padding } = data.plotData

	const left = interactive_padding.left_px
	const right = interactive_padding.right_px
	const top = interactive_padding.top_px
	const bottom = interactive_padding.bottom_px

	// Add y-axis
	const yAxisG = svg
		.append('g')
		.attr('transform', `translate(${settings.yAxisX + settings.yAxisSpace},${settings.yAxisY})`)
		.attr('font-size', `${settings.fontSize + 4}px`)

	const yScale = scaleLinear()
		.domain(y_domain) // [0, y_max]
		.range([plot_height - bottom, top]) // inverted, padded
	yAxisG.call(d3axis.axisLeft(yScale))

	// Add y-axis label
	svg
		.append('text')
		.attr('x', -(data.plotData.png_height / 2) - settings.yAxisY)
		.attr('y', settings.yAxisX / 2)
		.attr('transform', 'rotate(-90)')
		.attr('text-anchor', 'middle')
		.attr('font-size', `${settings.fontSize + 4}px`)
		.attr('fill', 'black')
		.text('-log₁₀(q-value)')

	// Add png image
	svg
		.append('image')
		.attr('transform', `translate(${settings.yAxisX + settings.yAxisSpace},${settings.yAxisY})`)
		.attr('width', data.plotData.png_width)
		.attr('height', data.plotData.png_height)
		.attr('href', `data:image/png;base64,${data.pngImg || data.png}`)

	const xScale = scaleLinear()
		.domain(x_domain) // [0, total_genome_length]
		.range([left, plot_width - right]) // padded pixel range

	// Transformation object passed in from Python side (manhattan2.py).
	// It describes how to convert raw genomic (x) or value (y) data
	// into actual pixel coordinates on the rendered plot.
	//
	// t = {
	//   x_offset: number,       // left pixel margin (padding in pixels)
	//   x_scale: number,        // scale factor: raw x → pixels per unit
	//   y_offset: number,       // bottom pixel position of plot area
	//   y_scale: number,        // scale factor: raw y → pixels per unit
	//   round_to_pixel: boolean // whether to snap to integer pixels (for crisp rendering)
	// }
	const t = data.plotData.transform
	// Convert raw genomic x-coordinate into a pixel x-coordinate
	function xPx(xRaw: number) {
		const v = t.x_offset + xRaw * t.x_scale
		return t.round_to_pixel ? Math.round(v) : v
	}
	// Convert raw y-value (e.g. -log10(p)) into a pixel y-coordinate
	function yPx(yVal: number) {
		const v = t.y_offset - yVal * t.y_scale
		return t.round_to_pixel ? Math.round(v) : v
	}

	const pngR = data.plotData.png_dot_radius
	const strokeW = settings.interactiveDotStrokeWidth
	// stroke sits half in/half out, so shrink radius to keep outer diameter equal to PNG dot
	const ringR = Math.max(1, pngR - strokeW * 0.5)

	// Add interactive dots layer
	if (settings.showInteractiveDots && data.plotData.points && data.plotData.points.length > 0) {
		const pointsLayer = svg
			.append('g')
			.attr('transform', `translate(${settings.yAxisX + settings.yAxisSpace},${settings.yAxisY})`)

		pointsLayer
			.selectAll('circle')
			.data(data.plotData.points)
			.enter()
			.append('circle')
			.attr('cx', d => xPx(d.x))
			.attr('cy', d => yPx(d.y))
			.attr('r', ringR)
			.attr('fill-opacity', 0)
			.attr('stroke', 'black')
			.attr('stroke-width', strokeW)
			.attr('stroke-opacity', 0)
			.attr('vector-effect', 'non-scaling-stroke')
			.attr('shape-rendering', 'geometricPrecision')
			.on('mouseover', (event, d) => {
				// Show stroke on hover
				event.target.setAttribute('stroke-opacity', 1)

				geneTip.clear().show(event.clientX, event.clientY)

				const table = table2col({
					holder: geneTip.d.append('div'),
					margin: '10px'
				})
				table.addRow('Gene', d.gene)
				const [t1, t2] = table.addRow()
				t1.text('Type')
				t2.html(`<span style="color:${d.color}">●</span> ${d.type.charAt(0).toUpperCase() + d.type.slice(1)}`)
				table.addRow('-log₁₀(q-value)', d.y.toFixed(3))
				if (d.nsubj) table.addRow('Subject count', d.nsubj)
				table.addRow('Chromosome', d.chrom)
			})
			.on('mouseout', event => {
				// Hide stroke on mouseout
				event.target.setAttribute('stroke-opacity', 0)
				geneTip.hide()
			})
			.on('click', (event, d) => {
				if (app) {
					// Open the genome browser with the current gene that is being clicked on
					app.dispatch({
						type: 'plot_create',
						config: {
							chartType: 'genomeBrowser',
							geneSearchResult: { geneSymbol: d.gene }
						}
					})
				}
			})

		// Add chromosome labels
		if (data.plotData.chrom_data) {
			const chromLabelY = data.plotData.png_height + settings.yAxisY + settings.chromLabelBuffer

			Object.entries(data.plotData.chrom_data).forEach(([chrom, chromData]: [string, any]) => {
				const chromLabel = chrom.replace('chr', '')

				// Skip chrM
				if (chromLabel === 'M') return

				// Calculate center position for label
				const centerPos = settings.yAxisX + settings.yAxisSpace + xScale(chromData.center)

				// Append chromosome label
				svg
					.append('text')
					.attr('x', centerPos)
					.attr('y', chromLabelY)
					.attr('text-anchor', 'middle')
					.attr('font-size', `${settings.fontSize + 2}px`)
					.attr('fill', 'black')
					.text(chromLabel)
			})
		}

		// Add x-axis label
		svg
			.append('text')
			.attr('x', settings.yAxisX + settings.yAxisSpace + data.plotData.png_width / 2)
			.attr('y', data.plotData.png_height + settings.yAxisY + settings.xAxisTitleBuffer)
			.attr('text-anchor', 'middle')
			.attr('font-size', `${settings.fontSize + 4}px`)
			.attr('fill', 'black')
			.text('Chromosomes')

		// Add title
		svg
			.append('text')
			.attr('x', settings.yAxisX + settings.yAxisSpace)
			.attr('y', settings.yAxisY / 2)
			.attr('text-anchor', 'left')
			.attr('font-weight', 'bold')
			.attr('font-size', `${settings.fontSize + 2}px`)
			.attr('fill', 'black')
			.text('Manhattan Plot')

		// Add download button if enabled
		if (settings.showDownload) {
			const downloadDiv = div
				.append('div')
				.style('position', 'absolute')
				.style('top', '5px')
				.style('left', `${settings.yAxisX + settings.yAxisSpace + 108}px`)
				.style('z-index', '10')
				.style('background', `${settings.background}`)
				.style('padding', `${settings.padding + 2}px`)
				.style('border-radius', `${settings.borderRadius + 10}px`)

			icons['download'](downloadDiv, {
				width: 16,
				height: 16,
				title: 'Download Manhattan plot',
				handler: () => {
					to_svg(
						svg.node() as SVGSVGElement,
						`manhattan_plot_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}`,
						{ apply_dom_styles: true }
					)
				}
			})
		}

		// Generate legend data
		const mutationTypes = [...new Set(data.plotData.points.map((p: any) => p.type))]
		const legendData = mutationTypes.map(type => {
			const point = data.plotData.points.find((p: any) => p.type === type)
			return {
				type: String(type).charAt(0).toUpperCase() + String(type).slice(1),
				color: point?.color || '#888888'
			}
		})

		// Add legend
		if (settings.showLegend && legendData.length > 0) {
			const legendY = settings.yAxisY / 2
			const totalWidth = legendData.length * settings.legendItemWidth
			const legendX =
				settings.yAxisX + settings.yAxisSpace + data.plotData.png_width - totalWidth - settings.legendRightOffset

			legendData.forEach((item, i) => {
				const x = legendX + i * settings.legendItemWidth

				// Legend dot
				svg
					.append('circle')
					.attr('cx', x + 8)
					.attr('cy', legendY)
					.attr('r', settings.legendDotRadius)
					.attr('fill', item.color)
					.attr('stroke', 'black')
					.attr('stroke-width', 1)

				// Legend text
				svg
					.append('text')
					.attr('x', x + 8 + settings.legendTextOffset)
					.attr('y', legendY + settings.legendVerticalOffset)
					.attr('font-size', `${settings.legendFontSize + 2}px`)
					.attr('fill', 'black')
					.text(item.type)
			})
		}
	}
}
