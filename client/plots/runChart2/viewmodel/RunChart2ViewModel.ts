import { scaleLinear } from 'd3-scale'
import { axisBottom, axisLeft } from 'd3-axis'
import { line } from 'd3-shape'
import { rgb } from 'd3-color'
import { roundValueAuto } from '#shared/roundValue.js'
import type { RunChart2 } from '../RunChart2.ts'
import type { ChartData } from '../model/RunChart2Model.ts'

export class RunChart2ViewModel {
	runChart2: RunChart2
	view: any
	model: any

	constructor(runChart2: RunChart2) {
		this.runChart2 = runChart2
		this.view = runChart2.view
		this.model = runChart2.model
	}

	render() {
		if (!this.view.dom.mainDiv) {
			console.error('RunChart2ViewModel: mainDiv not available')
			return
		}

		// Clear previous content
		this.view.dom.mainDiv.selectAll('*').remove()

		// Render each chart
		for (const chart of this.model.charts) {
			this.renderChart(chart)
		}
	}

	renderChart(chart: ChartData) {
		const mainDiv = this.view.dom.mainDiv
		const settings = this.runChart2.settings || {}
		const width = settings.svgw || 800
		const height = settings.svgh || 400
		const margin = { top: 20, right: 20, bottom: 60, left: 60 }
		const innerWidth = width - margin.left - margin.right
		const innerHeight = height - margin.top - margin.bottom

		// Create SVG
		const svg = mainDiv.append('svg').attr('width', width).attr('height', height).style('display', 'block')

		const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

		const points = chart.series.points || []

		if (points.length === 0) {
			g.append('text')
				.attr('x', innerWidth / 2)
				.attr('y', innerHeight / 2)
				.attr('text-anchor', 'middle')
				.text('No data available')
			return
		}

		// Create scales
		// For x-axis, use the actual decimal year values (e.g., 2024.01, 2024.02)
		// This ensures proper spacing between months
		const xMin = Math.min(...points.map(p => p.x))
		const xMax = Math.max(...points.map(p => p.x))

		// Add padding to the domain to prevent points from touching the edges
		const xPadding = (xMax - xMin) * 0.05 || 0.1
		const xScale = scaleLinear()
			.domain([xMin - xPadding, xMax + xPadding])
			.range([0, innerWidth])

		const yScale = scaleLinear()
			.domain([0, Math.max(...points.map(p => p.y)) * 1.1])
			.range([innerHeight, 0])

		// Draw line
		const lineBuilder = line<{ x: number; y: number }>()
			.x(d => xScale(d.x))
			.y(d => yScale(d.y))

		const color = settings.defaultColor || '#1f77b4'
		const medianColor = rgb(color).darker(2)

		g.append('path')
			.datum(points)
			.attr('fill', 'none')
			.attr('stroke', color)
			.attr('stroke-width', 2)
			.attr('d', lineBuilder)

		// Draw points
		g.selectAll('circle')
			.data(points)
			.enter()
			.append('circle')
			.attr('cx', (d: any) => xScale(d.x))
			.attr('cy', (d: any) => yScale(d.y))
			.attr('r', 4)
			.attr('fill', color)
			.attr('stroke', '#fff')
			.attr('stroke-width', 1)

		// Draw median line
		const median = chart.series.median
		if (median != null) {
			const yMedian = yScale(median)
			g.append('line')
				.attr('x1', 0)
				.attr('y1', yMedian)
				.attr('x2', innerWidth)
				.attr('y2', yMedian)
				.attr('stroke', medianColor.toString())
				.attr('stroke-width', 1)
				.attr('stroke-dasharray', '5,5')
				.attr('opacity', 0.7)

			g.append('text')
				.attr('x', innerWidth - 10)
				.attr('y', yMedian - 5)
				.attr('text-anchor', 'end')
				.attr('font-size', '12px')
				.attr('fill', medianColor.toString())
				.text(`M=${roundValueAuto(median, true, 1)}`)
		}

		// Draw axes
		// Use all point x values as tick values to show all months
		const xTickValues = points.map(p => p.x)

		const xAxis = axisBottom(xScale)
			.tickValues(xTickValues)
			.tickFormat(d => {
				const point = points.find(p => Math.abs(p.x - Number(d)) < 0.01)
				return point ? point.xName : String(d)
			})

		const yAxis = axisLeft(yScale)

		const xAxisGroup = g.append('g').attr('transform', `translate(0,${innerHeight})`).call(xAxis)

		// Style all x-axis labels - use smaller font and adjust rotation to minimize overlap
		xAxisGroup
			.selectAll('text')
			.style('text-anchor', 'end')
			.style('font-size', '10px')
			.attr('dx', '-.8em')
			.attr('dy', '.15em')
			.attr('transform', 'rotate(-45)')

		g.append('g').call(yAxis)

		// Add axis labels
		const config = this.runChart2.state?.config
		const xLabel = config?.term?.term?.name || 'Date'
		const yLabel = config?.term2?.term?.name || 'Value'

		g.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('y', 0 - margin.left)
			.attr('x', 0 - innerHeight / 2)
			.attr('dy', '1em')
			.style('text-anchor', 'middle')
			.text(yLabel)

		g.append('text')
			.attr('transform', `translate(${innerWidth / 2}, ${innerHeight + margin.bottom - 10})`)
			.style('text-anchor', 'middle')
			.text(xLabel)
	}
}
