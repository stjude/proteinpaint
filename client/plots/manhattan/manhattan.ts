import { scaleLinear } from 'd3-scale'
import * as d3axis from 'd3-axis'
import { select } from 'd3-selection'
import {
	Menu,
	icons,
	axisstyle,
	table2col,
	showResultsTable,
	createLollipopFromGene,
	DataPointInteractions
} from '#dom'
import { to_svg } from '#src/client'
import type { ManhattanPoint } from './manhattanTypes'

/**
 * Creates an interactive Manhattan plot on top of a PNG background plot image.
 *
 * @param {Object} div - div element to contain the plot
 * @param {Object} data - Plot data
 * @param {Object} settings - Display configuration options:
 *   @param {number} [settings.plotWidth=500] - Plot area width
 *   @param {number} [settings.plotHeight=200] - Plot area height
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
 *   @param {number} [settings.interactiveDotRadius=2] - Radius of interactive dots
 *   @param {number} [settings.xAxisLabelPad=20] - Amount of padding we give for x-axis title padding
 *   @param {number} [settings.interactiveDotStrokeWidth=1] - Stroke width for interactive dots
 *   @param {string} [settings.axisColor='#545454'] - Color for y-axis
 *   @param {boolean} [settings.showYAxisLine=true] - Whether to show y-axis line
 *   @param {number} [settings.interactiveDotsCap=5000] - Interactive dots cap
 *   @param {number} [settings.maxTooltipGenes=5] - Maximum number of genes to show in tooltip
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

	// Check size of interactive data
	let interactivePoints = data.plotData.points
	if (data.plotData.points.length > settings.interactiveDotsCap) {
		// Sort points by y value (-log10(q-value)) descending and take top N up to interactiveDotsCap
		interactivePoints = data.plotData.points.sort((a: any, b: any) => b.y - a.y).slice(0, settings.interactiveDotsCap)
	}

	// Set the  positioning up for download button to work properly
	div.style('position', 'relative')

	// Hover tooltip menu — DataPointInteractions writes into this on hover.
	const geneTip = new Menu({ padding: '' })

	const svg = div
		.append('svg')
		.attr('data-testid', 'sjpp-manhattan')
		.attr('width', settings.plotWidth + 2 * settings.pngDotRadius + settings.yAxisX + settings.yAxisSpace)
		.attr('height', settings.plotHeight + 2 * settings.pngDotRadius + settings.yAxisY * 4) // Extra space for x-axis labels, legend, and title

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
		.range([settings.plotHeight + 2 * settings.pngDotRadius, 0]) // full PNG height

	// 2) yAxisScale: used only for the visible axis labels/ticks
	//    - Domain = true data values (no padding)
	//    - Range  = subset of pixel space between yPlot(0) and yPlot(realMax [data.plotData.y_max - data.plotData.png_dot_radius])
	//               so the axis sits entirely within the real data area
	const yAxisScale = scaleLinear()
		.domain([0, data.plotData.y_max - settings.pngDotRadius])
		.range([yPlot(0), yPlot(data.plotData.y_max - settings.pngDotRadius)])

	// Axis group
	const axisG = svg
		.append('g')
		.attr('transform', `translate(${settings.yAxisX + settings.yAxisSpace - settings.yAxisPad},${settings.yAxisY})`)

	axisG.call(
		d3axis.axisLeft(yAxisScale).tickSizeOuter(0) // removes top/bottom cap lines for clean look
	)

	axisstyle({
		axis: axisG,
		color: settings.axisColor,
		fontsize: settings.fontSize + 2,
		showline: settings.showYAxisLine
	})

	// Add y-axis label
	svg
		.append('text')
		.attr('x', -((settings.plotHeight + 2 * settings.pngDotRadius) / 2) - settings.yAxisY)
		.attr('y', settings.yAxisX / 2)
		.attr('transform', 'rotate(-90)')
		.attr('text-anchor', 'middle')
		.attr('font-size', `${settings.fontSize + 4}px`)
		.attr('fill', 'black')
		.text(data.plotData.has_capped_points ? '-log₁₀(q-value) [capped]' : '-log₁₀(q-value)')

	// Add png image
	svg
		.append('image')
		.attr('transform', `translate(${settings.yAxisX + settings.yAxisSpace},${settings.yAxisY})`)
		.attr('width', settings.plotWidth + 2 * settings.pngDotRadius)
		.attr('height', settings.plotHeight + 2 * settings.pngDotRadius)
		.attr('href', `data:image/png;base64,${data.pngImg || data.png}`)

	// Create scales for positioning elements
	const xScale = scaleLinear()
		.domain([-data.plotData.x_buffer, data.plotData.total_genome_length + data.plotData.x_buffer])
		.range([0, settings.plotWidth + 2 * settings.pngDotRadius])

	// Add interactive dots layer
	if (settings.showInteractiveDots && data.plotData.points && data.plotData.points.length > 0) {
		// Hover-ring layer — `pointer-events: none` so rings never intercept clicks.
		const hoverLayer = svg
			.append('g')
			.attr('transform', `translate(${settings.yAxisX + settings.yAxisSpace},${settings.yAxisY})`)
			.style('pointer-events', 'none')

		// Cover as a sibling HTML div positioned over the plot area — avoids
		// the mouse-event quirks of nesting inside SVG.
		const cover = select(svg.node().parentNode as HTMLElement)
			.append('div')
			.style('position', 'absolute')
			.style('left', `${settings.yAxisX + settings.yAxisSpace}px`)
			.style('top', `${settings.yAxisY}px`)
			.style('width', `${settings.plotWidth + 2 * settings.pngDotRadius}px`)
			.style('height', `${settings.plotHeight + 2 * settings.pngDotRadius}px`)
			.style('pointer-events', 'all')

		// Circle as an SVG path so it flows through the generic `drawHoverShapes`.
		const circlePath = (r: number) => `M${r},0 A${r},${r} 0 1,1 ${-r},0 A${r},${r} 0 1,1 ${r},0 Z`

		const interactions = new DataPointInteractions<ManhattanPoint>({
			cover,
			hoverLayer,
			hoverTip: geneTip,
			points: interactivePoints,
			getX: d => d.pixel_x,
			getY: d => d.pixel_y,
			hitRadius: settings.pngDotRadius + 3,
			toHoverSpec: d => ({
				path: circlePath(settings.pngDotRadius),
				transform: `translate(${d.pixel_x},${d.pixel_y})`,
				fill: 'none',
				stroke: 'black',
				strokeWidth: settings.interactiveDotStrokeWidth
			}),
			maxTooltipRows: settings.maxTooltipGenes,
			itemNoun: 'gene',
			renderSingleHoverTooltip: (d, container) => {
				const table = table2col({ holder: container.append('div'), margin: '10px' })
				table.addRow('Gene', d.gene)
				table.addRow('Position', `${d.chrom}:${d.start}-${d.end}`)
				const [t1, t2] = table.addRow()
				t1.text('Type')
				t2.html(`<span style="color:${d.color}">●</span> ${d.type.charAt(0).toUpperCase() + d.type.slice(1)}`)
				table.addRow('Q-value', d.q_value.toPrecision(3))
				table.addRow('Subject count', d.nsubj)
			},
			buildMultiHitTableData: dots => ({
				columns: [
					{ label: 'Gene' },
					{ label: 'Position' },
					{ label: 'Type' },
					{ label: 'Q-value', sortable: true },
					{ label: 'Subject count', sortable: true }
				],
				rows: dots.map(d => [
					{ value: d.gene },
					{ value: `${d.chrom}:${d.start}-${d.end}` },
					{
						html: `<span style="color:${d.color}">●</span> ${d.type.charAt(0).toUpperCase() + d.type.slice(1)}`
					},
					{ value: d.q_value.toPrecision(3) },
					{ value: d.nsubj }
				])
			}),
			// Manhattan single-click goes straight to a lollipop launch — no menu.
			// Release hover-suppression immediately so the cursor's next move re-engages.
			onSingleClick: (d, _event, ctx) => {
				ctx.dismiss()
				if (app) createLollipopFromGene(d.gene, app)
			},
			// Manhattan multi-click shows showResultsTable directly with `app + clickMenu`
			// so the table renders inline Matrix/Lollipop buttons. Reuses the module's
			// clickMenu so its onHide cleanup (clear flag, clear hover) fires on dismiss.
			// Content is built BEFORE show2 so Menu can measure the populated rect for
			// its right-edge clamp — otherwise the wide table is placed at cursor+offsetX
			// and extends off the right edge of the viewport.
			onMultiClick: (dots, event, ctx) => {
				if (!app) {
					ctx.dismiss()
					return
				}
				ctx.clickMenu.clear()
				const holder = ctx.clickMenu.d.append('div').style('margin', '10px')
				showResultsTable({ tableDiv: holder, hits: dots, app, clickMenu: ctx.clickMenu })
				ctx.clickMenu.show2(event.clientX, event.clientY)
			}
		})

		interactions.attach()
	}

	// Add chromosome labels
	if (data.plotData.chrom_data) {
		const chromLabelY = settings.plotHeight + 2 * settings.pngDotRadius + settings.yAxisY + 10

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
		.attr('x', settings.yAxisX + settings.yAxisSpace + (settings.plotWidth + 2 * settings.pngDotRadius) / 2)
		.attr('y', settings.plotHeight + 2 * settings.pngDotRadius + settings.yAxisY + settings.xAxisLabelPad)
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
				// Clone the SVG to avoid modifying the displayed version
				const svgNode = svg.node() as SVGSVGElement
				const clone = svgNode.cloneNode(true) as SVGSVGElement

				// Get the bounding box of all content
				const bbox = svgNode.getBBox()

				// Set the clone's dimensions to match the full content
				clone.setAttribute('width', bbox.width.toString())
				clone.setAttribute('height', bbox.height.toString())
				clone.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`)

				to_svg(clone, `manhattan_plot_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}`, {
					apply_dom_styles: true
				})
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
			settings.yAxisX +
			settings.yAxisSpace +
			(settings.plotWidth + 2 * settings.pngDotRadius) -
			totalWidth -
			settings.legendRightOffset

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
