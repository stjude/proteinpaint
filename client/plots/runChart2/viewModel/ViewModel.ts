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
			/** This assumes the response data is sorted by x values
			 * TODO: move to server response?? */
			const first = series.points[0]
			const last = series.points[series.points.length - 1]
			this.xMin = Math.min(first.x, this.xMin)
			this.xMax = Math.max(last.x, this.xMax)
			this.yMin = Math.min(first.y, this.yMin)
			this.yMax = Math.max(last.y, this.yMax)
		}

		return {
			plotDims: this.getPlotDimensions()
		}
	}

	getPlotDimensions() {
		const plotDims = {
			svg: {
				height: this.settings.svgh + this.#vertPad * 2,
				width: this.settings.svgw + this.#horizPad * 2
			},
			xAxis: {
				scale: scaleLinear().domain([this.xMin, this.xMax]).range([0, this.settings.svgw]),
				x: this.#horizPad,
				y: this.settings.svgh + this.#vertPad
			},
			yAxis: {
				scale: scaleLinear().domain([this.yMin, this.yMax]).range([this.settings.svgh, 0]),
				x: this.#horizPad,
				y: this.#vertPad
			}
		}
		return plotDims
	}
}
