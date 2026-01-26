import type { RunChart2Settings } from '../Settings.ts'
import { scaleLinear } from 'd3-scale'

export class RunChart2ViewModel {
	//Same padding on right and left of the chart
	#horizPad = 70
	#vertPad = 40

	settings: RunChart2Settings
	xMin = Infinity
	xMax = -Infinity
	yMin = Infinity
	yMax = -Infinity

	constructor(settings: RunChart2Settings) {
		this.settings = settings
	}

	map(data: any) {
		for (const series of data) {
			if (!series.points || series.points.length === 0) continue

			for (const point of series.points) {
				this.xMin = Math.min(point.x, this.xMin)
				this.xMax = Math.max(point.x, this.xMax)
				this.yMin = Math.min(point.y, this.yMin)
				this.yMax = Math.max(point.y, this.yMax)
			}
		}

		// Add padding to y-axis domain
		const yPadding = (this.yMax - this.yMin) * 0.1 || 1
		const yMinWithPadding = Math.max(0, this.yMin - yPadding)
		const yMaxWithPadding = this.yMax + yPadding

		return {
			series: data,
			plotDims: this.getPlotDimensions(yMinWithPadding, yMaxWithPadding)
		}
	}

	getPlotDimensions(yMin?: number, yMax?: number) {
		// Add padding to x-axis domain
		const xPadding = (this.xMax - this.xMin) * 0.05 || 0.1
		const xMinWithPadding = this.xMin - xPadding
		const xMaxWithPadding = this.xMax + xPadding

		const plotDims = {
			svg: {
				height: this.settings.svgh + this.#vertPad * 2,
				width: this.settings.svgw + this.#horizPad * 2
			},
			xAxis: {
				scale: scaleLinear().domain([xMinWithPadding, xMaxWithPadding]).range([0, this.settings.svgw]),
				x: this.#horizPad,
				y: this.settings.svgh + this.#vertPad
			},
			yAxis: {
				scale: scaleLinear()
					.domain([yMin ?? this.yMin, yMax ?? this.yMax])
					.range([this.settings.svgh, 0]),
				x: this.#horizPad,
				y: this.#vertPad
			}
		}
		return plotDims
	}
}
