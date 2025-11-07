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
 *   @param {number} [settings.fontSize=12] - Base font size
 *   @param {number} [settings.pngDotRadius=2] - Radius of dots in PNG plot
 *   @param {number} [settings.legendItemWidth=80] - Horizontal space per legend item
 *   @param {number} [settings.legendDotRadius=3] - Size of legend dots
 *   @param {number} [settings.legendRightOffset=15] - Offset from right edge
 *   @param {number} [settings.legendTextOffset=12] - Distance between dot and text
 *   @param {number} [settings.legendVerticalOffset=4] - Vertical offset for legend items
 *   @param {number} [settings.legendFontSize=12] - Font size for legend text
 *   @param {number} [settings.interactiveDotRadius=3] - Radius of interactive dots
 *   @param {number} [settings.xAxisLabelPad=20] - Amount of padding we give for x-axis title padding
 *   @param {number} [settings.interactiveDotStrokeWidth=1] - Stroke width for interactive dots
 * @param {Object} [app] - Optional app context for dispatching events
 *
 *
 * @description
 * Renders a genomic Manhattan plot by overlaying interactive elements on the base PNG plot image.
 * Features include chromosome labels, legend, hoverable data points with tooltips,
 * and proper axis scaling. The plot combines a static PNG plot image of all points with dynamic SVG elements
 * including axes, labels, legend, and top genes (represented as interactive dots) for detailed information on hover.
 */

export function plotManhattan(div: any, data: any, settings: any, app?: any) {
	// Get our settings
	settings = {
		...settings
	}

	// Set the  positioning up for download button to work properly
	div.style('position', 'relative')

	// Create tooltip menu
	const geneTip = new Menu({ padding: '' })

	const svg = div
		.append('svg')
		.attr('data-testid', 'sjpp-manhattan')
		.attr('width', data.plotData.png_width + settings.yAxisX + settings.yAxisSpace)
		.attr('height', data.plotData.png_height + settings.yAxisY * 4) // Extra space for x-axis labels, legend, and title

	// Add y-axis
	// yPlot       → full padded scale, aligns exactly with PNG coordinates
	// yAxisScale  → trimmed scale for axis labels, ignores PNG padding
	// --- Y-Axis Setup ---
	// This section builds two linked scales:
	//
	//   1) yPlot       → full PNG-aligned scale (includes padding added by Rust)
	//   2) yAxisScale  → visual axis scale (no padding; shows only real data values)
	//
	// The reason for two scales is that the PNG image itself was rendered
	// with top/bottom padding for dot radius. We need one scale to stay
	// pixel-perfect with the PNG (for dots, overlays, etc.), and another
	// scale to make the visible y-axis line up only with the *real* data region.

	// 1) yPlot: true positioning scale used for all pixel-aligned elements
	//    - Domain = padded range from Rust (includes buffer above/below real data)
	//    - Range  = full PNG pixel height (0 is top, png_height is bottom)
	const yPlot = scaleLinear()
		.domain([data.plotData.y_min, data.plotData.y_max]) // padded domain from Rust
		.range([data.plotData.png_height, 0]) // full PNG height

	// 2) yAxisScale: used only for the visible axis labels/ticks
	//    - Domain = true data values (no padding)
	//    - Range  = subset of pixel space between yPlot(0) and yPlot(realMax [data.plotData.y_max - data.plotData.png_dot_radius])
	//               so the axis sits entirely within the real data area
	const yAxisScale = scaleLinear()
		.domain([0, data.plotData.y_max - data.plotData.png_dot_radius])
		.range([yPlot(0), yPlot(data.plotData.y_max - data.plotData.png_dot_radius)])

	// Axis group
	const axisG = svg
		.append('g')
		.attr('transform', `translate(${settings.yAxisX + settings.yAxisSpace - settings.yAxisPad},${settings.yAxisY})`)
		.style('font-size', `${settings.fontSize + 2}px`)

	axisG.call(
		d3axis.axisLeft(yAxisScale).tickSizeOuter(0) // removes top/bottom cap lines for clean look
	)

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

	// Create scales for positioning elements
	const xScale = scaleLinear()
		.domain([-data.plotData.x_buffer, data.plotData.total_genome_length + data.plotData.x_buffer])
		.range([0, data.plotData.png_width])

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
			.attr('cx', d => d.pixel_x)
			.attr('cy', d => d.pixel_y)
			.attr('r', settings.interactiveDotRadius * devicePixelRatio) // We need to scale with devicePixelRatio otherwise we just have a tine dot on high-DPI screens perfectly aligned with the PNG dots
			.attr('fill-opacity', 0)
			.attr('stroke', 'black')
			.attr('stroke-width', settings.interactiveDotStrokeWidth)
			.attr('stroke-opacity', 0)
			.on('mouseover', (event, d) => {
				// Show stroke on hover
				event.target.setAttribute('stroke-opacity', 1)

				geneTip.clear().show(event.clientX, event.clientY)

				const table = table2col({
					holder: geneTip.d.append('div'),
					margin: '10px'
				})
				table.addRow('Gene', d.gene)
				table.addRow('Position', `${d.chrom}:${d.start}-${d.end}`)
				const [t1, t2] = table.addRow()
				t1.text('Type')
				t2.html(`<span style="color:${d.color}">●</span> ${d.type.charAt(0).toUpperCase() + d.type.slice(1)}`)
				table.addRow('-log₁₀(q-value)', d.y.toFixed(3))
				table.addRow('Subject count', d.nsubj)
			})
			.on('mouseout', event => {
				// Hide stroke on mouseout
				event.target.setAttribute('stroke-opacity', 0)
				geneTip.hide()
			})
			.on('click', (event, d) => {
				// if app is avaialble, open the genome browser with the current gene that is being clicked on
				if (app) createLollipopFromGene(d.gene, app)
			})
	}

	// Add chromosome labels
	if (data.plotData.chrom_data) {
		const chromLabelY = data.plotData.png_height + settings.yAxisY

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
				.text(chromLabel)
		})
	}

	// Add x-axis label
	svg
		.append('text')
		.attr('x', settings.yAxisX + settings.yAxisSpace + data.plotData.png_width / 2)
		// .attr('y', data.plotData.png_height + settings.yAxisY + 20)
		.attr('y', data.plotData.png_height + settings.yAxisY + settings.xAxisLabelPad)
		.attr('text-anchor', 'middle')
		.attr('font-size', `${settings.fontSize + 4}px`)
		.attr('fill', 'black')
		.text('Chromosomes')

	// Add title
	svg
		.append('text')
		.attr('x', settings.yAxisX + settings.yAxisSpace)
		.attr('y', settings.yAxisY / 2)
		.attr('font-weight', 'bold')
		.attr('font-size', `${settings.fontSize + 2}px`)
		.text('Manhattan Plot')

	if (settings.showDownload) {
		const downloadDiv = div
			.append('div')
			.style('position', 'absolute')
			.style('top', '5px')
			.style('left', `${settings.yAxisX + settings.yAxisSpace + 108}px`)

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
			color: point?.color
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

			// Legend text
			svg
				.append('text')
				.attr('x', x + 8 + settings.legendTextOffset)
				.attr('y', legendY + settings.legendVerticalOffset)
				.attr('font-size', `${settings.legendFontSize + 2}px`)
				.text(item.type)
		})
	}
}

export function createLollipopFromGene(geneSymbol: string, app: any) {
	const cfg: any = {
		type: 'plot_create',
		config: {
			chartType: 'genomeBrowser',
			snvindel: { shown: true }, // always set snvindel.shown=true so the mds3 tk is always shown; since grin2 works for this ds, it doesn't matter whether snvindel/cnv/svfusion any is present; all will be shown in mds3 tk
			geneSearchResult: { geneSymbol }
		}
	}
	if (app.vocabApi.termdbConfig.queries.trackLst?.activeTracks) {
		cfg.config.trackLst = structuredClone(app.vocabApi.termdbConfig.queries.trackLst)
		cfg.config.trackLst.activeTracks = [] // clear all active tracks as they are not related to grin2 analysis
		// cannot do cfg.config.trackLst={activeTracks:[]}; breaks
	}
	app.dispatch(cfg)
}
