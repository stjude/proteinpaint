import { scaleLinear } from 'd3-scale'
import * as d3axis from 'd3-axis'
import { Menu, icons, axisstyle, table2col } from '#dom'
import { to_svg } from '#src/client'
import { quadtree } from 'd3-quadtree'
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

// Define styles once at the top of your file or in a constants section
const TABLE_STYLES = {
	cell: [
		['padding', '5px'],
		['border', '1px solid #ddd']
	] as const,
	header: [
		['padding', '5px'],
		['border', '1px solid #ddd'],
		['font-weight', 'bold']
	] as const,
	positionCell: [
		['padding', '5px'],
		['border', '1px solid #ddd'],
		['font-size', '0.9em']
	] as const
}

function styleGeneTipCell(td: any, styleType: keyof typeof TABLE_STYLES = 'cell') {
	TABLE_STYLES[styleType].forEach(style => {
		const [prop, value] = style
		td.style(prop, value)
	})
	return td
}

function styleGeneTipHeader(th: any) {
	TABLE_STYLES.header.forEach(([prop, value]) => th.style(prop, value))
	return th
}

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

	// Create tooltip menu
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
		.text('-log₁₀(q-value)')

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
		const pointsLayer = svg
			.append('g')
			.attr('transform', `translate(${settings.yAxisX + settings.yAxisSpace},${settings.yAxisY})`)

		// Add transparent cover for mousemove detection with dots underneath
		const cover = pointsLayer
			.append('rect')
			.attr('x', 0)
			.attr('y', 0)
			.attr('width', settings.plotWidth + 2 * settings.pngDotRadius)
			.attr('height', settings.plotHeight + 2 * settings.pngDotRadius)
			.attr('fill', 'transparent')
			.attr('pointer-events', 'all')

		// Track which dots are currently highlighted
		let highlightedDots: ManhattanPoint[] = []

		const dpr = data.plotData.device_pixel_ratio // In rust, it is clamped to a minimum of 1.0. If browser is zoomed out it can be < 1.0 and cause an error. Hence we use the value from rust directly instead of window.devicePixelRatio

		// Normalize pixel coordinates from high-DPR space to CSS pixel space
		const normalizedPoints = interactivePoints.map((p: ManhattanPoint) => ({
			...p,
			pixel_x: p.pixel_x / dpr,
			pixel_y: p.pixel_y / dpr
		}))

		const pointQuadtree = quadtree<ManhattanPoint>()
			.x(d => d.pixel_x)
			.y(d => d.pixel_y)
			.addAll(normalizedPoints)

		cover
			.on('mousemove', event => {
				// Use SVG's native coordinate transformation instead of d3's pointer()
				// This properly handles browser zoom that we have been seeing issues with
				const svgElement = cover.node().ownerSVGElement
				const ctm = cover.node().getScreenCTM()
				let mx: number, my: number

				if (ctm && svgElement) {
					const point = svgElement.createSVGPoint()
					point.x = event.clientX
					point.y = event.clientY
					const svgPoint = point.matrixTransform(ctm.inverse())
					mx = svgPoint.x
					my = svgPoint.y
				}

				// Find all dots within hit radius
				// TODO: Make hit radius  user configurable with its own setting
				const hitRadius = settings.pngDotRadius + 3

				// Find all points within hit radius with their distances
				const candidates: Array<{ point: ManhattanPoint; distance: number }> = []

				pointQuadtree.visit((node, x1, y1, x2, y2) => {
					// Skip this node if it's outside the search radius
					if (x1 > mx + hitRadius || x2 < mx - hitRadius || y1 > my + hitRadius || y2 < my - hitRadius) {
						return true // Skip this branch
					}

					// If this is a leaf node, check the point
					if (!node.length) {
						const point = node.data
						if (point) {
							const px = point.pixel_x
							const py = point.pixel_y
							const distance = Math.sqrt((mx - px) ** 2 + (my - py) ** 2)

							if (distance <= hitRadius) {
								candidates.push({ point, distance })
							}
						}
					}

					return false // Don't stop early - check all nodes in radius
				})

				// Sort by distance and take the 5 closest points
				candidates.sort((a, b) => a.distance - b.distance)
				const nearbyDots = candidates.slice(0, 5).map(c => c.point)

				// Always remove old circles first
				pointsLayer.selectAll('.hover-circle').remove()

				if (nearbyDots.length > 1) {
					// Add new hover circles for nearby dots
					nearbyDots.forEach(d => {
						pointsLayer
							.append('circle')
							.attr('class', 'hover-circle')
							.attr('cx', d.pixel_x)
							.attr('cy', d.pixel_y)
							.attr('r', settings.pngDotRadius)
							.attr('fill', 'none')
							.attr('stroke', 'black')
							.attr('stroke-width', settings.interactiveDotStrokeWidth)
					})

					highlightedDots = nearbyDots

					// Show tooltip with table
					geneTip.clear().show(event.clientX, event.clientY)

					const holder = geneTip.d.append('div').style('margin', '10px')
					const table = holder.append('table').style('border-collapse', 'collapse')

					// Add thead element for header row
					const thead = table.append('thead')
					const headerRow = thead.append('tr')
					const headers = ['Gene', 'Position', 'Type', '-log₁₀(q-value)', 'Subject count']
					headers.forEach(text => {
						styleGeneTipHeader(headerRow.append('th').text(text))
					})

					// Add tbody element for data rows
					const tbody = table.append('tbody')
					nearbyDots.forEach(d => {
						const row = tbody.append('tr')
						styleGeneTipCell(row.append('td').text(d.gene))
						styleGeneTipCell(row.append('td').text(`${d.chrom}:${d.start}-${d.end}`), 'positionCell')
						styleGeneTipCell(
							row
								.append('td')
								.html(`<span style="color:${d.color}">●</span> ${d.type.charAt(0).toUpperCase() + d.type.slice(1)}`)
						)
						styleGeneTipCell(row.append('td').text(d.y.toFixed(3)))
						styleGeneTipCell(row.append('td').text(d.nsubj))
					})
				} else if (nearbyDots.length === 1) {
					// Single gene - use table2col format
					const d = nearbyDots[0]

					// Add hover circle for the single dot
					pointsLayer
						.append('circle')
						.attr('class', 'hover-circle')
						.attr('cx', d.pixel_x)
						.attr('cy', d.pixel_y)
						.attr('r', settings.pngDotRadius)
						.attr('fill', 'none')
						.attr('stroke', 'black')
						.attr('stroke-width', settings.interactiveDotStrokeWidth)

					highlightedDots = nearbyDots

					// Show tooltip with table2col format
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
				} else {
					// No dots nearby, hide tooltip
					highlightedDots = []
					geneTip.hide()
				}
			})
			.on('mouseout', () => {
				// Remove all hover circles and hide tooltip
				pointsLayer.selectAll('.hover-circle').remove()
				highlightedDots = []
				geneTip.hide()
			})
			.on('click', _event => {
				// Click on the first highlighted dot if any
				if (highlightedDots.length > 0 && app) {
					createLollipopFromGene(highlightedDots[0].gene, app)
				}
			})
	}

	// Add chromosome labels
	if (data.plotData.chrom_data) {
		const chromLabelY = settings.plotHeight + 2 * settings.pngDotRadius + settings.yAxisY

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
