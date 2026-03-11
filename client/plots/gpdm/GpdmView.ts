import { scaleLinear } from 'd3-scale'
import { line, area, curveMonotoneX } from 'd3-shape'
import { axisBottom, axisLeft } from 'd3-axis'
import { axisstyle } from '#dom'
import type { GpdmResponseData, GpdmGridData, GpdmDom } from './GpdmTypes'

/** Layout constants */
const margin = { top: 25, right: 40, bottom: 40, left: 65 }
const panelWidth = 750
const gpFitHeight = 220
const diffHeight = 160
const probHeight = 90
const dmrHeight = 50
const panelGap = 30

const groupAColor = '#2166ac'
const groupBColor = '#b2182b'
const diffColor = '#4a4a4a'
const dmrColor = '#e66101'
const naiveDmrColor = '#998ec3'

export class GpdmView {
	dom: GpdmDom
	data: GpdmResponseData
	group1Name: string
	group2Name: string
	geneName: string

	constructor(dom: GpdmDom, data: GpdmResponseData, group1Name: string, group2Name: string, geneName: string) {
		this.dom = dom
		this.data = data
		this.group1Name = group1Name
		this.group2Name = group2Name
		this.geneName = geneName
		this.render()
	}

	render() {
		this.dom.content.selectAll('*').remove()

		const totalHeight =
			margin.top + gpFitHeight + panelGap + diffHeight + panelGap + probHeight + panelGap + dmrHeight + margin.bottom
		const totalWidth = margin.left + panelWidth + margin.right

		const svg = this.dom.content
			.append('svg')
			.attr('width', totalWidth)
			.attr('height', totalHeight)
			.style('font-family', 'Arial, sans-serif')

		const grid = this.data.grid
		const positions = grid.positions

		// Shared x scale (genomic position)
		const xScale = scaleLinear()
			.domain([positions[0], positions[positions.length - 1]])
			.range([0, panelWidth])

		let yOffset = margin.top

		// Panel 1: GP Fit (group means with confidence bands)
		this.renderGpFitPanel(svg, xScale, grid, yOffset)
		yOffset += gpFitHeight + panelGap

		// Panel 2: Difference (delta with CI)
		this.renderDiffPanel(svg, xScale, grid, yOffset)
		yOffset += diffHeight + panelGap

		// Panel 3: Posterior probability
		this.renderProbPanel(svg, xScale, grid, yOffset)
		yOffset += probHeight + panelGap

		// Panel 4: DMR track
		this.renderDmrPanel(svg, xScale, yOffset)

		// Shared x axis at the bottom
		yOffset += dmrHeight
		const xAxisG = svg.append('g').attr('transform', `translate(${margin.left}, ${yOffset})`)
		xAxisG.call(
			axisBottom(xScale)
				.ticks(8)
				.tickFormat(d => `${(+d / 1e6).toFixed(2)}Mb`)
		)
		axisstyle({ axis: xAxisG, color: 'black', showline: true })

		// X axis label
		svg
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('x', margin.left + panelWidth / 2)
			.attr('y', yOffset + 28)
			.attr('font-size', '12px')
			.text(`Genomic position (${this.data.metadata.region})`)

		// Legend (rendered as HTML below the SVG)
		this.renderLegend()

		// Metadata summary
		this.renderMetadata()
	}

	renderGpFitPanel(svg: any, xScale: any, grid: GpdmGridData, yOffset: number) {
		const g = svg.append('g').attr('transform', `translate(${margin.left}, ${yOffset})`)

		// Determine y domain from both groups' CI bounds
		const allVals = [...grid.group_a_lower, ...grid.group_a_upper, ...grid.group_b_lower, ...grid.group_b_upper].filter(
			v => isFinite(v)
		)
		const yMin = Math.min(...allVals)
		const yMax = Math.max(...allVals)
		const yPad = (yMax - yMin) * 0.05
		const yScale = scaleLinear()
			.domain([yMin - yPad, yMax + yPad])
			.range([gpFitHeight, 0])

		// Background
		g.append('rect')
			.attr('width', panelWidth)
			.attr('height', gpFitHeight)
			.attr('fill', '#fafafa')
			.attr('stroke', '#ddd')

		const positions = grid.positions

		// Group A confidence band
		this.renderBand(g, positions, grid.group_a_lower, grid.group_a_upper, xScale, yScale, groupAColor, 0.15)
		// Group B confidence band
		this.renderBand(g, positions, grid.group_b_lower, grid.group_b_upper, xScale, yScale, groupBColor, 0.15)

		// Group A mean line
		this.renderLine(g, positions, grid.group_a_mean, xScale, yScale, groupAColor, 2)
		// Group B mean line
		this.renderLine(g, positions, grid.group_b_mean, xScale, yScale, groupBColor, 2)

		// Y axis
		const yAxisG = g.append('g')
		yAxisG.call(axisLeft(yScale).ticks(5))
		axisstyle({ axis: yAxisG, color: 'black', showline: true })

		// Panel label (above panel)
		g.append('text')
			.attr('x', 0)
			.attr('y', -6)
			.attr('font-size', '13px')
			.attr('font-weight', 'bold')
			.text('GP Methylation Fit')

		// Y axis label
		g.append('text')
			.attr('text-anchor', 'middle')
			.attr('transform', `translate(-45, ${gpFitHeight / 2}) rotate(-90)`)
			.attr('font-size', '12px')
			.text('Beta value')
	}

	renderDiffPanel(svg: any, xScale: any, grid: GpdmGridData, yOffset: number) {
		const g = svg.append('g').attr('transform', `translate(${margin.left}, ${yOffset})`)

		const allVals = [...grid.difference_lower, ...grid.difference_upper].filter(v => isFinite(v))
		const yMin = Math.min(...allVals)
		const yMax = Math.max(...allVals)
		const yPad = Math.max((yMax - yMin) * 0.05, 0.01)
		const yScale = scaleLinear()
			.domain([yMin - yPad, yMax + yPad])
			.range([diffHeight, 0])

		// Background
		g.append('rect').attr('width', panelWidth).attr('height', diffHeight).attr('fill', '#fafafa').attr('stroke', '#ddd')

		const positions = grid.positions

		// Zero line
		g.append('line')
			.attr('x1', 0)
			.attr('x2', panelWidth)
			.attr('y1', yScale(0))
			.attr('y2', yScale(0))
			.attr('stroke', '#999')
			.attr('stroke-dasharray', '4,4')

		// Confidence band
		this.renderBand(g, positions, grid.difference_lower, grid.difference_upper, xScale, yScale, diffColor, 0.2)

		// Highlight regions where CI excludes zero (significant difference)
		this.highlightSignificantRegions(g, positions, grid.difference_lower, grid.difference_upper, xScale, yScale)

		// Mean difference line
		this.renderLine(g, positions, grid.difference_mean, xScale, yScale, diffColor, 2)

		// Y axis
		const yAxisG = g.append('g')
		yAxisG.call(axisLeft(yScale).ticks(4))
		axisstyle({ axis: yAxisG, color: 'black', showline: true })

		// Panel label (above panel)
		g.append('text')
			.attr('x', 0)
			.attr('y', -6)
			.attr('font-size', '13px')
			.attr('font-weight', 'bold')
			.text(`Methylation Difference (${this.group2Name} − ${this.group1Name})`)

		// Y axis label
		g.append('text')
			.attr('text-anchor', 'middle')
			.attr('transform', `translate(-45, ${diffHeight / 2}) rotate(-90)`)
			.attr('font-size', '12px')
			.text('Δ Beta')
	}

	renderProbPanel(svg: any, xScale: any, grid: GpdmGridData, yOffset: number) {
		const g = svg.append('g').attr('transform', `translate(${margin.left}, ${yOffset})`)

		const yScale = scaleLinear().domain([0, 1]).range([probHeight, 0])

		// Background
		g.append('rect').attr('width', panelWidth).attr('height', probHeight).attr('fill', '#fafafa').attr('stroke', '#ddd')

		const positions = grid.positions

		// Threshold lines
		for (const thresh of [0.95, 0.975]) {
			g.append('line')
				.attr('x1', 0)
				.attr('x2', panelWidth)
				.attr('y1', yScale(thresh))
				.attr('y2', yScale(thresh))
				.attr('stroke', '#c44')
				.attr('stroke-dasharray', '3,3')
				.attr('stroke-opacity', 0.6)

			g.append('text')
				.attr('x', panelWidth + 3)
				.attr('y', yScale(thresh) + 4)
				.attr('font-size', '9px')
				.attr('fill', '#c44')
				.text(String(thresh))
		}

		// Posterior probability as filled area
		const areaGen = area<number>()
			.x((_d, i) => xScale(positions[i]))
			.y0(probHeight)
			.y1((_d, i) => yScale(grid.posterior_prob[i]))
			.curve(curveMonotoneX)

		g.append('path')
			.datum(positions)
			.attr('d', areaGen as any)
			.attr('fill', dmrColor)
			.attr('fill-opacity', 0.3)

		// Probability line
		this.renderLine(g, positions, grid.posterior_prob, xScale, yScale, dmrColor, 1.5)

		// Y axis
		const yAxisG = g.append('g')
		yAxisG.call(axisLeft(yScale).tickValues([0, 0.5, 1]))
		axisstyle({ axis: yAxisG, color: 'black', showline: true })

		// Panel label (above panel)
		g.append('text')
			.attr('x', 0)
			.attr('y', -6)
			.attr('font-size', '13px')
			.attr('font-weight', 'bold')
			.text('Posterior Probability of Differential Methylation')
	}

	renderDmrPanel(svg: any, xScale: any, yOffset: number) {
		const g = svg.append('g').attr('transform', `translate(${margin.left}, ${yOffset})`)

		// Background
		g.append('rect').attr('width', panelWidth).attr('height', dmrHeight).attr('fill', '#f5f5f5').attr('stroke', '#ddd')

		// Annotation-aware DMRs (top half)
		for (const dmr of this.data.dmrs) {
			const x1 = xScale(dmr.start)
			const x2 = xScale(dmr.stop)
			g.append('rect')
				.attr('x', Math.max(0, x1))
				.attr('y', 2)
				.attr('width', Math.max(2, x2 - x1))
				.attr('height', 16)
				.attr('fill', dmrColor)
				.attr('fill-opacity', Math.min(1, dmr.probability))
				.attr('stroke', dmrColor)
				.attr('stroke-width', 0.5)
			g.append('title').text(
				`DMR: ${dmr.chr}:${dmr.start}-${dmr.stop}\nΔβ: ${dmr.max_delta_beta.toFixed(
					3
				)}\nP(DM): ${dmr.probability.toFixed(3)}`
			)
		}

		// Naive DMRs (bottom half)
		for (const dmr of this.data.naive_dmrs) {
			const x1 = xScale(dmr.start)
			const x2 = xScale(dmr.stop)
			g.append('rect')
				.attr('x', Math.max(0, x1))
				.attr('y', 22)
				.attr('width', Math.max(2, x2 - x1))
				.attr('height', 14)
				.attr('fill', naiveDmrColor)
				.attr('fill-opacity', Math.min(1, dmr.probability))
				.attr('stroke', naiveDmrColor)
				.attr('stroke-width', 0.5)
			g.append('title').text(
				`Naive DMR: ${dmr.chr}:${dmr.start}-${dmr.stop}\nΔβ: ${dmr.max_delta_beta.toFixed(
					3
				)}\nP(DM): ${dmr.probability.toFixed(3)}`
			)
		}

		// Panel label (above panel)
		g.append('text')
			.attr('x', 0)
			.attr('y', -6)
			.attr('font-size', '13px')
			.attr('font-weight', 'bold')
			.text('Detected DMRs')

		// Row labels
		g.append('text').attr('x', -5).attr('y', 16).attr('font-size', '10px').attr('text-anchor', 'end').text('Annot.')
		g.append('text').attr('x', -5).attr('y', 38).attr('font-size', '10px').attr('text-anchor', 'end').text('Naive')
	}

	renderLegend() {
		const legend = this.dom.content
			.append('div')
			.style('display', 'flex')
			.style('flex-wrap', 'wrap')
			.style('gap', '16px')
			.style('margin', '8px 0 4px 65px')
			.style('font-size', '12px')
			.style('font-family', 'Arial, sans-serif')

		const items = [
			{ color: groupAColor, label: this.group1Name },
			{ color: groupBColor, label: this.group2Name },
			{ color: dmrColor, label: 'Annotation-aware DMR' },
			{ color: naiveDmrColor, label: 'Naive DMR' }
		]

		for (const item of items) {
			const entry = legend.append('div').style('display', 'flex').style('align-items', 'center').style('gap', '5px')
			entry
				.append('div')
				.style('width', '12px')
				.style('height', '12px')
				.style('background', item.color)
				.style('border-radius', '2px')
				.style('flex-shrink', '0')
			entry.append('span').text(item.label)
		}
	}

	renderMetadata() {
		const meta = this.data.metadata
		const div = this.dom.content.append('div').style('margin', '10px 0').style('font-size', '13px')

		const table = div.append('table').style('border-collapse', 'collapse')
		const rows = [
			['Region', meta.region],
			['Probes in region', String(meta.n_probes)],
			['Samples (group 1)', String(meta.n_samples_group1)],
			['Samples (group 2)', String(meta.n_samples_group2)],
			['Annotation-aware DMRs', String(this.data.dmrs.length)],
			['Naive DMRs', String(this.data.naive_dmrs.length)]
		]

		for (const [label, value] of rows) {
			const tr = table.append('tr')
			tr.append('td').style('padding', '2px 10px 2px 0').style('font-weight', 'bold').text(label)
			tr.append('td').style('padding', '2px 0').text(value)
		}

		// DMR details table
		if (this.data.dmrs.length > 0) {
			div.append('div').style('margin-top', '10px').style('font-weight', 'bold').text('Detected DMRs:')
			const dmrTable = div
				.append('table')
				.style('border-collapse', 'collapse')
				.style('margin-top', '5px')
				.style('font-size', '12px')

			const thead = dmrTable.append('thead')
			const headerRow = thead.append('tr')
			for (const h of ['Region', 'Width', 'Max Δβ', 'P(DM)']) {
				headerRow
					.append('th')
					.style('padding', '3px 8px')
					.style('border-bottom', '1px solid #ccc')
					.style('text-align', 'left')
					.text(h)
			}

			const tbody = dmrTable.append('tbody')
			for (const dmr of this.data.dmrs) {
				const tr = tbody.append('tr')
				tr.append('td').style('padding', '2px 8px').text(`${dmr.chr}:${dmr.start}-${dmr.stop}`)
				tr.append('td').style('padding', '2px 8px').text(`${dmr.width} bp`)
				tr.append('td').style('padding', '2px 8px').text(dmr.max_delta_beta.toFixed(3))
				tr.append('td').style('padding', '2px 8px').text(dmr.probability.toFixed(3))
			}
		}
	}

	/** Render a shaded confidence band between lower and upper arrays */
	private renderBand(
		g: any,
		positions: number[],
		lower: number[],
		upper: number[],
		xScale: any,
		yScale: any,
		color: string,
		opacity: number
	) {
		const areaGen = area<number>()
			.x((_d, i) => xScale(positions[i]))
			.y0((_d, i) => yScale(lower[i]))
			.y1((_d, i) => yScale(upper[i]))
			.curve(curveMonotoneX)

		g.append('path')
			.datum(positions)
			.attr('d', areaGen as any)
			.attr('fill', color)
			.attr('fill-opacity', opacity)
	}

	/** Render a line from positions and values */
	private renderLine(
		g: any,
		positions: number[],
		values: number[],
		xScale: any,
		yScale: any,
		color: string,
		width: number
	) {
		const lineGen = line<number>()
			.x((_d, i) => xScale(positions[i]))
			.y((_d, i) => yScale(values[i]))
			.curve(curveMonotoneX)

		g.append('path')
			.datum(positions)
			.attr('d', lineGen as any)
			.attr('fill', 'none')
			.attr('stroke', color)
			.attr('stroke-width', width)
	}

	/** Highlight contiguous regions where CI excludes zero */
	private highlightSignificantRegions(
		g: any,
		positions: number[],
		lower: number[],
		upper: number[],
		xScale: any,
		yScale: any
	) {
		// Find contiguous regions where both bounds are on the same side of zero
		let inRegion = false
		let regionStart = 0

		for (let i = 0; i < positions.length; i++) {
			const sigHere = (lower[i] > 0 && upper[i] > 0) || (lower[i] < 0 && upper[i] < 0)
			if (sigHere && !inRegion) {
				inRegion = true
				regionStart = i
			} else if (!sigHere && inRegion) {
				inRegion = false
				this.drawHighlightRect(g, positions, regionStart, i - 1, xScale, yScale)
			}
		}
		if (inRegion) {
			this.drawHighlightRect(g, positions, regionStart, positions.length - 1, xScale, yScale)
		}
	}

	private drawHighlightRect(g: any, positions: number[], startIdx: number, endIdx: number, xScale: any, _yScale: any) {
		const x1 = xScale(positions[startIdx])
		const x2 = xScale(positions[endIdx])
		g.append('rect')
			.attr('x', x1)
			.attr('y', 0)
			.attr('width', Math.max(1, x2 - x1))
			.attr('height', diffHeight)
			.attr('fill', '#ff6600')
			.attr('fill-opacity', 0.08)
	}
}
