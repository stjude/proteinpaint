import { scaleLinear } from 'd3-scale'
import * as d3axis from 'd3-axis'
import { select } from 'd3-selection'
import { Menu, icons, axisstyle, table2col, sayerror } from '#dom'
import { to_svg } from '#src/client'
import { quadtree, type Quadtree } from 'd3-quadtree'
import type { ManhattanPoint } from './manhattanTypes'
// import { MANHATTAN_LOG_QVALUE_CUTOFF } from '#shared'
import { get$id } from '#termsetting'
import { showGrin2ResultTable } from '../grin2/grin2.ts'
import type { GeneDataItem } from '../grin2/GRIN2Types.ts'

/**
 * Searches a quadtree for all points within a specified radius of target coordinates.
 *
 * @param {Object} quadtree - D3 quadtree containing ManhattanPoint data
 * @param {number} mx - Target x coordinate (in pixels)
 * @param {number} my - Target y coordinate (in pixels)
 * @param {number} hitRadius - Search radius (in pixels)
 * @returns {Array<{point: ManhattanPoint, distance: number}>} Array of points within radius with their distances
 */
function findPointsInRadius(
	quadtree: Quadtree<ManhattanPoint>,
	mx: number,
	my: number,
	hitRadius: number
): Array<{ point: ManhattanPoint; distance: number }> {
	const candidates: Array<{ point: ManhattanPoint; distance: number }> = []

	quadtree.visit((node, x1, y1, x2, y2) => {
		// Skip this node if it's outside the search radius
		if (x1 > mx + hitRadius || x2 < mx - hitRadius || y1 > my + hitRadius || y2 < my - hitRadius) {
			return true // Skip this branch
		}

		// If this is a leaf node, check ALL points (including coincident ones)
		if (!node.length) {
			// Traverse the linked list of coincident points
			let current: any = node
			while (current) {
				const point = current.data
				if (point) {
					const px = point.pixel_x
					const py = point.pixel_y
					const distance = Math.sqrt((mx - px) ** 2 + (my - py) ** 2)

					if (distance <= hitRadius) {
						candidates.push({ point, distance })
					}
				}
				current = current.next // Move to next coincident point
			}
		}

		return false // Don't stop early - check all nodes in radius
	})

	return candidates
}

/**
 * Updates selection order tracking and determines the last touched gene.
 * This function is used by interactive selection buttons (Lollipop, Matrix) to track
 * which item was most recently selected, even when multiple items are selected.
 *
 * @param {number[]} currentSelectionOrder - Current array tracking selection order (indices in order of selection)
 * @param {number[]} selectedIndices - New array of selected indices from the selection UI
 * @param {GeneDataItem[]} dataSource - Array of data items containing gene information
 *   Can be either ManhattanPoints with `gene` property or table rows with `value` property
 * @returns {{selectionOrder: number[], lastTouchedGene: string | null, buttonText: string, buttonDisabled: boolean}}
 *   - selectionOrder: Updated array of indices in selection order
 *   - lastTouchedGene: Gene symbol of most recently selected item, or null if no selection
 *   - buttonText: Suggested button text including gene name if available
 *   - buttonDisabled: Whether the button should be disabled (true when no gene is selected)
 */
export function updateSelectionTracking(
	currentSelectionOrder: number[],
	selectedIndices: number[],
	dataSource: GeneDataItem[]
): { selectionOrder: number[]; lastTouchedGene: string | null; buttonText: string; buttonDisabled: boolean } {
	// Find newly selected items
	const newlySelected = selectedIndices.filter(idx => !currentSelectionOrder.includes(idx))

	// Update selection order: remove deselected items, add newly selected ones
	const updatedSelectionOrder = currentSelectionOrder.filter(idx => selectedIndices.includes(idx))
	updatedSelectionOrder.push(...newlySelected)

	let lastTouchedGene: string | null = null
	let buttonText = 'Lollipop'

	if (updatedSelectionOrder.length > 0) {
		// Get the most recently selected gene (last in selectionOrder)
		const lastSelectedIdx = updatedSelectionOrder[updatedSelectionOrder.length - 1]
		const dataItem = dataSource[lastSelectedIdx]

		// Handle both ManhattanPoint objects (with 'gene' property) and table rows (arrays with value property)
		if (Array.isArray(dataItem)) {
			// Table row format: array of cells with value property
			lastTouchedGene = dataItem[0]?.value || null
		} else {
			// ManhattanPoint format: object with gene property
			lastTouchedGene = (dataItem as { gene: string }).gene
		}

		buttonText = `Lollipop (${lastTouchedGene})`
	}

	return {
		selectionOrder: updatedSelectionOrder,
		lastTouchedGene,
		buttonText,
		buttonDisabled: lastTouchedGene === null
	}
}

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
 *   @param {number} [settings.xAxisTickPad=12] - Amount of padding we give for x-axis tick labels
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

	console.log('Manhattan plot settings:', settings)
	console.log('Manhattan plot data:', data)

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
	// Create click menu for showing all nearby genes
	let clickMenuIsShown = false
	const clickMenu = new Menu({
		padding: '',
		onHide: () => {
			clickMenuIsShown = false
		}
	})

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
	// .text(data.plotData.y_max >= MANHATTAN_LOG_QVALUE_CUTOFF ? '-log₁₀(q-value) [capped]' : '-log₁₀(q-value)')

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
		// Create a group for hover circles inside the SVG
		const pointsLayer = svg
			.append('g')
			.attr('transform', `translate(${settings.yAxisX + settings.yAxisSpace},${settings.yAxisY})`)

		// Create cover as a sibling div positioned over the plot area
		// This avoids mouse event issues when nested inside SVG
		const cover = select(svg.node().parentNode as HTMLElement)
			.append('div')
			.style('position', 'absolute')
			.style('left', `${settings.yAxisX + settings.yAxisSpace}px`)
			.style('top', `${settings.yAxisY}px`)
			.style('width', `${settings.plotWidth + 2 * settings.pngDotRadius}px`)
			.style('height', `${settings.plotHeight + 2 * settings.pngDotRadius}px`)
			.style('pointer-events', 'all')

		// Track which dots are currently highlighted
		let highlightedDots: ManhattanPoint[] = []

		const normalizedPoints = interactivePoints

		const pointQuadtree = quadtree<ManhattanPoint>()
			.x(d => d.pixel_x)
			.y(d => d.pixel_y)
			.addAll(normalizedPoints)

		cover
			.on('mousemove', event => {
				// Don't show hover tooltip if click menu is open
				if (clickMenuIsShown) return
				// Get mouse position relative to the cover div
				const rect = (cover.node() as HTMLElement).getBoundingClientRect()
				const mx = event.clientX - rect.left
				const my = event.clientY - rect.top

				// Find all dots within hit radius
				// TODO: Make hit radius user configurable with its own setting
				const hitRadius = settings.pngDotRadius + 3

				// Find all points within hit radius with their distances
				const candidates = findPointsInRadius(pointQuadtree, mx, my, hitRadius)

				// Sort by distance and take the closest points based on settings.maxTooltipGenes setting
				candidates.sort((a, b) => a.distance - b.distance)
				const nearbyDots = candidates.slice(0, settings.maxTooltipGenes).map(c => c.point)
				const additionalCount = candidates.length - settings.maxTooltipGenes

				// Always remove old circles first
				pointsLayer.selectAll('.hover-circle').remove()

				if (nearbyDots.length > 0) {
					// Add hover circles for all nearby dots
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

					// Show tooltip
					geneTip.clear().show(event.clientX, event.clientY)
					if (nearbyDots.length > 1) {
						// Multiple genes
						const holder = geneTip.d.append('div').style('margin', '10px')

						showGrin2ResultTable({ tableDiv: holder, hits: nearbyDots })

						// Show message if there are more dots beyond the settings.maxTooltipGenes shown
						// TODO: Make these settings abstracted out and can improve this later
						if (additionalCount > 0) {
							holder
								.append('div')
								.style('font-size', '0.85em')
								.style('color', '#666')
								.style('font-style', 'italic')
								.text(`and ${additionalCount} more gene${additionalCount > 1 ? 's' : ''}...`)
						}
					} else {
						// Single gene - use table2col format
						const d = nearbyDots[0]
						const table = table2col({
							holder: geneTip.d.append('div'),
							margin: '10px'
						})
						table.addRow('Gene', d.gene)
						table.addRow('Position', `${d.chrom}:${d.start}-${d.end}`)
						const [t1, t2] = table.addRow()
						t1.text('Type')
						t2.html(`<span style="color:${d.color}">●</span> ${d.type.charAt(0).toUpperCase() + d.type.slice(1)}`)
						table.addRow('Q-value', d.q_value.toPrecision(3))
						table.addRow('Subject count', d.nsubj)
					}
				} else {
					// No dots nearby, hide tooltip
					highlightedDots = []
					geneTip.hide()
				}
			})
			.on('mouseleave', () => {
				// Remove all hover circles and hide tooltip
				pointsLayer.selectAll('.hover-circle').remove()
				highlightedDots = []
				geneTip.hide()
			})
			.on('click', event => {
				// Don't do anything if no dots nearby or no app context
				if (highlightedDots.length === 0 || !app) return

				// Hide the hover tooltip
				geneTip.hide()

				// Get ALL candidates within hit radius (reusing the quadtree search)
				const rect = (cover.node() as HTMLElement).getBoundingClientRect()
				const mx = event.clientX - rect.left
				const my = event.clientY - rect.top
				const hitRadius = settings.pngDotRadius + 3

				const allCandidates = findPointsInRadius(pointQuadtree, mx, my, hitRadius)

				allCandidates.sort((a, b) => a.distance - b.distance)
				const allNearbyDots = allCandidates.map(c => c.point)

				if (allNearbyDots.length === 1) {
					// Single gene - launch directly
					createLollipopFromGene(allNearbyDots[0].gene, app)
				} else if (allNearbyDots.length > 1) {
					// Multiple genes - show click menu with table
					clickMenu.clear().show(event.clientX, event.clientY)
					clickMenuIsShown = true

					const holder = clickMenu.d.append('div').style('margin', '10px')

					showGrin2ResultTable({ tableDiv: holder, hits: allNearbyDots, app, clickMenu })
				}
			})
	}

	// Add chromosome labels
	if (data.plotData.chrom_data) {
		const chromLabelY = settings.plotHeight + 2 * settings.pngDotRadius + settings.yAxisY + settings.xAxisTickPad

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

export async function createMatrixFromGenes(geneSymbols: string[], app: any): Promise<void> {
	// TODO: Improve this by maybe adding sayInfo that has a little div that shows a message letting the user know the matrix is being created with only the first N genes if they selected too many
	const MAX_GENES = 100
	const genesToUse = geneSymbols.slice(0, MAX_GENES)

	try {
		const termwrappers = await Promise.all(
			genesToUse.map(async (gene: string) => {
				const term = {
					type: 'geneVariant',
					gene: gene,
					name: gene
				}
				const minTwCopy = app.vocabApi.getTwMinCopy({ term, q: {} })
				return {
					$id: await get$id(minTwCopy),
					term,
					q: {}
				}
			})
		)

		app.dispatch({
			type: 'plot_create',
			config: {
				chartType: 'matrix',
				dataType: 'geneVariant',
				termgroups: [
					{
						name: 'Genomic Alterations',
						lst: termwrappers
					}
				]
			}
		})
	} catch (error) {
		sayerror(app.dom.div, `Error creating matrix: ${error instanceof Error ? error.message : error}`)
	}
}
