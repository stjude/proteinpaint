import { scaleLinear } from 'd3-scale'
import * as d3axis from 'd3-axis'
import { Menu, table2col } from '#dom'

/******* THIS IS A QUICK FIX ****** /
 * These functions are shared between plots/grin2 and gdc/grin2
 * Eventually the manhattan plot will be decoupled from grin2
 * into this dir.
 */
export function renderInteractivePoints(svg: any, plotData: any, geneTip?) {
	// Add visible interactive points using pre-calculated SVG coordinates
	const pointsLayer = svg.append('g')

	if (!geneTip) geneTip = new Menu({ padding: '' })

	pointsLayer
		.selectAll('circle')
		.data(plotData.points)
		.enter()
		.append('circle')
		.attr('cx', d => d.svg_x)
		.attr('cy', d => d.svg_y)
		.attr('r', 2.5)
		.attr('fill-opacity', 0)
		.attr('stroke', 'black')
		.attr('stroke-width', 1)
		.attr('stroke-opacity', 0)
		.on('mouseover', (event, d) => {
			event.target.setAttribute('stroke-opacity', 1)
			geneTip.clear().show(event.clientX, event.clientY)

			const table = table2col({
				holder: geneTip.d.append('div'),
				margin: '10px'
			})
			table.addRow('Gene', d.gene)
			const [t1, t2] = table.addRow()
			t1.text('Type')
			t2.html(`<span style="color:${d.color}">●</span> ${d.type}`)
			table.addRow('-log10(q-value)', d.y.toFixed(3))
			table.addRow('Subject count', d.nsubj)
			table.addRow('Chromosome', d.chrom)
		})
		.on('mouseout', event => {
			event.target.setAttribute('stroke-opacity', 0)
			geneTip.hide()
		})
}

export function addLegend(plotData: any, svg: any) {
	// Get unique mutation types and their colors from the data
	const mutationTypes = [...new Set(plotData.points.map((p: any) => p.type))]
	const legendData = mutationTypes.map(type => {
		const point = plotData.points.find((p: any) => p.type === type)
		return {
			type: String(type).charAt(0).toUpperCase() + String(type).slice(1),
			color: point?.color || '#888888'
		}
	})

	// Position legend in the top margin area, accounting for the full SVG dimensions
	const margin = { bottom: 60, left: 50, right: 30, top: 40 }
	const legendY = 15 // Position from top of SVG
	const itemWidth = 80
	const totalWidth = legendData.length * itemWidth
	const legendX = plotData.plot_width + margin.left - totalWidth // Position from right edge

	// Legend items
	legendData.forEach((item, i) => {
		const x = legendX + i * itemWidth

		// Legend dot
		svg
			.append('circle')
			.attr('cx', x + 8)
			.attr('cy', legendY)
			.attr('r', 2.5)
			.attr('fill', item.color)
			.attr('stroke', 'black')
			.attr('stroke-width', 1)

		// Legend text
		svg
			.append('text')
			.attr('x', x + 20)
			.attr('y', legendY + 4)
			.attr('font-size', '12px')
			.attr('fill', 'black')
			.text(item.type)
	})
}

/** Calculates the plot dimensions with an offset before rendering. */
export function setPlotDims(plotData: any, settings: any) {
	const offset = 10
	const xAxisStart = plotData.plot_height + offset
	/** In the python code, the radius * 2 is used to pad the top and bottom
	 * of the png. Hence the radius * 3. */
	const yScaleRange = plotData.plot_height - settings.radius * 3 - offset * 2

	const plotDims = {
		svg: {
			height: plotData.plot_height + settings.bottom + settings.top,
			width: plotData.plot_width + settings.left,
			x: settings.left,
			y: settings.top
		},
		xAxis: {
			scale: scaleLinear()
				.domain([0, plotData.total_genome_length])
				.range([0, plotData.plot_width - settings.right])
		},
		chrsLabel: {
			start: settings.left + offset * 2 + 5,
			end: settings.left,
			y: xAxisStart + offset * 2
		},
		xLabel: {
			x: settings.left + plotData.plot_width / 2,
			y: xAxisStart + settings.top + offset * 4
		},
		yAxis: {
			x: settings.left,
			y: settings.top + offset + settings.radius * 2,
			scale: scaleLinear()
				.domain([0, Math.max(...plotData.points.map(p => p.y))])
				.range([yScaleRange, 0])
		},
		yLabel: {
			x: -plotData.plot_height / 2,
			y: offset * 4
		}
	}
	return plotDims
}

export function addAxesToExistingPlot(plotData: any, svg: any, plotDims: any) {
	const fontSize = 12 //TODO: maybe move this to settings as well and reuse
	// Expand SVG to accommodate labels
	svg.attr('width', plotDims.svg.width).attr('height', plotDims.svg.height)

	// Move existing content into a group with margin offset
	const existingContent = svg.selectAll('*')
	const plotGroup = svg.append('g').attr('transform', `translate(${plotDims.svg.x}, ${plotDims.svg.y})`)

	// Move existing elements to the offset group
	existingContent.each(function (this: Element) {
		plotGroup.node()!.appendChild(this)
	})

	const addAxisLabel = (x: number, y: number, text: string, isLeft = false) => {
		const label = svg
			.append('text')
			.attr('x', x)
			.attr('y', y)
			.attr('text-anchor', 'middle')
			.attr('font-size', `${fontSize}px`)
			.attr('fill', 'black')
			.text(text)

		if (isLeft) label.attr('transform', `rotate(-90)`)
	}

	// x-axis
	const xScale = plotDims.xAxis

	// Add chromosome labels (instead of numbered ticks) to the x-axis
	if (plotData.chrom_data) {
		Object.entries(plotData.chrom_data).forEach(([chrom, data]: [string, any]) => {
			const chromLabel = chrom.replace('chr', '')

			// Skip if the label is "M"
			if (chromLabel === 'M') return

			const centerPos = plotDims.chrsLabel.start + xScale.scale(data.center)

			// Position label at true center
			svg
				.append('text')
				.attr('x', centerPos)
				.attr('y', plotDims.chrsLabel.y)
				.attr('text-anchor', 'middle')
				.attr('font-size', `${fontSize - 2}px`)
				.attr('fill', 'black')
				.text(chrom.replace('chr', ''))
		})
	}

	//Bottom label for x-axis
	addAxisLabel(plotDims.xLabel.x, plotDims.xLabel.y, 'Chromosomes')

	// y-axis
	const yScale = plotDims.yAxis
	// Y-axis at left
	const yAxisG = svg.append('g').attr('transform', `translate(${yScale.x}, ${yScale.y})`)
	yAxisG.call(d3axis.axisLeft(yScale.scale))

	// Y-axis label
	addAxisLabel(plotDims.yLabel.x, plotDims.yLabel.y, '-log₁₀(q-value)', true)
}
