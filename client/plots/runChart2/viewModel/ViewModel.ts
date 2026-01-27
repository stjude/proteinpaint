import type { RunChart2Settings } from '../Settings.ts'
import { scaleLinear } from 'd3-scale'

export class RunChart2ViewModel {
	//Same padding on right and left of the chart
	#horizPad = 70
	#vertPad = 40
	#bottomLabelPad = 40
	#leftLabelPad = 50

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

		const hasValidRange =
			Number.isFinite(this.xMin) &&
			Number.isFinite(this.xMax) &&
			this.xMin < this.xMax &&
			Number.isFinite(this.yMin) &&
			Number.isFinite(this.yMax) &&
			this.yMin < this.yMax

		let xMinForDomain: number, xMaxForDomain: number, yMinForDomain: number, yMaxForDomain: number
		if (hasValidRange) {
			const usePaddingX = this.settings.minXScale == null && this.settings.maxXScale == null
			const xPadding = usePaddingX ? (this.xMax - this.xMin) * 0.05 || 0.1 : 0
			xMinForDomain = this.settings.minXScale ?? this.xMin - xPadding
			xMaxForDomain = this.settings.maxXScale ?? this.xMax + xPadding

			const usePaddingY = this.settings.minYScale == null && this.settings.maxYScale == null
			const yPadding = usePaddingY ? (this.yMax - this.yMin) * 0.1 || 1 : 0
			const yMinAuto = usePaddingY ? Math.max(0, this.yMin - yPadding) : this.yMin
			const yMaxAuto = usePaddingY ? this.yMax + yPadding : this.yMax
			yMinForDomain = this.settings.minYScale ?? yMinAuto
			yMaxForDomain = this.settings.maxYScale ?? yMaxAuto
		} else {
			xMinForDomain = 0
			xMaxForDomain = 1
			yMinForDomain = 0
			yMaxForDomain = 1
		}

		return {
			series: data,
			plotDims: this.getPlotDimensions({
				xMin: xMinForDomain,
				xMax: xMaxForDomain,
				yMin: yMinForDomain,
				yMax: yMaxForDomain
			})
		}
	}

	getPlotDimensions(domains: { xMin: number; xMax: number; yMin: number; yMax: number }) {
		const { xMin, xMax, yMin, yMax } = domains
		const plotDims = {
			svg: {
				height: this.settings.svgh + this.#vertPad + this.#bottomLabelPad,
				width: this.settings.svgw + this.#horizPad + this.#leftLabelPad
			},
			xAxis: {
				scale: scaleLinear().domain([xMin, xMax]).range([0, this.settings.svgw]),
				x: this.#horizPad + this.#leftLabelPad,
				y: this.settings.svgh + this.#vertPad
			},
			yAxis: {
				scale: scaleLinear().domain([yMin, yMax]).range([this.settings.svgh, 0]),
				x: this.#horizPad + this.#leftLabelPad,
				y: this.#vertPad
			}
		}
		return plotDims
	}
}
