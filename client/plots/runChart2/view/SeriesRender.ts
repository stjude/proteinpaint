import { line } from 'd3-shape'
import { rgb } from 'd3-color'
import { roundValueAuto } from '#shared/roundValue.js'
import type { RunChart2Settings } from '../Settings.ts'

export class SeriesRender {
	series: any
	plotDims: any
	settings: RunChart2Settings
	seriesGroup: any

	constructor(series: any, plotDims: any, settings: RunChart2Settings, seriesGroup: any) {
		this.series = series
		this.plotDims = plotDims
		this.settings = settings
		this.seriesGroup = seriesGroup
		this.render()
	}

	render() {
		if (!this.series.points || this.series.points.length === 0) return

		const color = this.settings.color || '#1f77b4'
		const medianColor = rgb(color).darker(2)

		// Sort points by x value to ensure proper line drawing
		const sortedPoints = [...this.series.points].sort((a, b) => a.x - b.x)

		// Draw line connecting all points
		const lineBuilder = line<{ x: number; y: number }>()
			.x(d => this.plotDims.xAxis.scale(d.x))
			.y(d => this.plotDims.yAxis.scale(d.y))

		this.seriesGroup
			.append('path')
			.datum(sortedPoints)
			.attr('fill', 'none')
			.attr('stroke', color)
			.attr('stroke-width', 2)
			.attr('stroke-linejoin', 'round')
			.attr('d', lineBuilder)

		// Draw points (circles)
		this.seriesGroup
			.selectAll('circle')
			.data(sortedPoints)
			.enter()
			.append('circle')
			.attr('cx', d => this.plotDims.xAxis.scale(d.x))
			.attr('cy', d => this.plotDims.yAxis.scale(d.y))
			.attr('r', 4)
			.attr('fill', color)
			.attr('stroke', '#fff')
			.attr('stroke-width', 1)

		// Draw median line if median is available
		if (this.series.median != null && !isNaN(this.series.median)) {
			const yMedian = this.plotDims.yAxis.scale(this.series.median)
			const xStart = this.plotDims.xAxis.scale(sortedPoints[0].x)
			const xEnd = this.plotDims.xAxis.scale(sortedPoints[sortedPoints.length - 1].x)

			// Draw median horizontal line
			this.seriesGroup
				.append('line')
				.attr('x1', xStart)
				.attr('y1', yMedian)
				.attr('x2', xEnd)
				.attr('y2', yMedian)
				.attr('stroke', medianColor.toString())
				.attr('stroke-width', 1)
				.attr('stroke-dasharray', '5,5')
				.attr('opacity', 0.7)

			// Add median label
			this.seriesGroup
				.append('text')
				.attr('x', xEnd - 10)
				.attr('y', yMedian - 5)
				.attr('text-anchor', 'end')
				.attr('font-size', '12px')
				.attr('fill', medianColor.toString())
				.text(`M=${roundValueAuto(this.series.median, true, 1)}`)
		}
	}
}
