import { line } from 'd3-shape'
import { rgb } from 'd3-color'
import { roundValueAuto } from '#shared/roundValue.js'
import type { RunChart2Settings } from '../Settings.ts'
import type { RunChart2 } from '../RunChart2.ts'

/** Clamp value to [min, max] when set. Returns the capped coordinate (scatter-style axis cap). */
function getCoordinate(val: number, min: number | null, max: number | null): number {
	if (min != null && val < min) return min
	if (max != null && val > max) return max
	return val
}

export class SeriesRender {
	series: any
	plotDims: any
	settings: RunChart2Settings
	seriesGroup: any
	runChart2: RunChart2 | undefined

	constructor(series: any, plotDims: any, settings: RunChart2Settings, seriesGroup: any, runChart2?: RunChart2) {
		this.series = series
		this.plotDims = plotDims
		this.settings = settings
		this.seriesGroup = seriesGroup
		this.runChart2 = runChart2
		this.render()
	}

	/** Returns the calculated coordinate or the min/max axis cap set by the user (matches scatter getCoordinates). */
	getCoordinates(d: { x: number; y: number }): { x: number; y: number } {
		const cx = getCoordinate(d.x, this.settings.minXScale, this.settings.maxXScale)
		const cy = getCoordinate(d.y, this.settings.minYScale, this.settings.maxYScale)
		return {
			x: this.plotDims.xAxis.scale(cx),
			y: this.plotDims.yAxis.scale(cy)
		}
	}

	render() {
		if (!this.series.points || this.series.points.length === 0) return

		const color = this.settings.color || '#1f77b4'
		const medianColor = rgb(color).darker(2)

		// Sort points by x value to ensure proper line drawing
		const sortedPoints = [...this.series.points].sort((a, b) => a.x - b.x)

		// Draw line connecting all points (cap y to minYScale/maxYScale before scale, like scatter getCoordinates)
		const lineBuilder = line<{ x: number; y: number }>()
			.x(d => this.getCoordinates(d).x)
			.y(d => this.getCoordinates(d).y)

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
			.attr('cx', d => this.getCoordinates(d).x)
			.attr('cy', d => this.getCoordinates(d).y)
			.attr('r', 4)
			.attr('fill', color)
			.attr('stroke', '#fff')
			.attr('stroke-width', 1)
			.style('cursor', 'pointer')
			.on('click', (event: any, d: any) => {
				if (this.runChart2) {
					this.showPointMenu(event, d)
				}
			})

		// Draw median line if median is available
		if (this.series.median != null && !isNaN(this.series.median)) {
			const yMedian = this.plotDims.yAxis.scale(
				getCoordinate(this.series.median, this.settings.minYScale, this.settings.maxYScale)
			)
			const xStart = this.getCoordinates(sortedPoints[0]).x
			const xEnd = this.getCoordinates(sortedPoints[sortedPoints.length - 1]).x

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

	showPointMenu(event: any, point: any) {
		if (!this.runChart2 || !this.runChart2.dom.clickMenu) return

		const menu = this.runChart2.dom.clickMenu
		menu.clear()

		const menuDiv = menu.d.append('div').attr('class', 'sja_menu_div')

		const options = [
			{
				label: `Date: ${point.xName}`,
				callback: () => {
					menu.hide()
				}
			},
			{
				label: `Value: ${roundValueAuto(point.y, true, 2)}`,
				callback: () => {
					menu.hide()
				}
			},
			{
				label: `Sample Count: ${point.sampleCount}`,
				callback: () => {
					menu.hide()
				}
			}
		]

		menuDiv
			.selectAll('div')
			.data(options)
			.enter()
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text(d => d.label)
			.style('cursor', 'pointer')
			.on('click', (event: any, d: any) => {
				d.callback()
			})

		menu.show(event.clientX, event.clientY)
	}
}
