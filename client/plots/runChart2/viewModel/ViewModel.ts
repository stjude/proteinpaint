import type { RunChart2Settings } from '../Settings.ts'
import { scaleLinear } from 'd3-scale'

export class RunChart2ViewModel {
	#horizPad = 70
	#vertPad = 40
	#bottomLabelPad = 72
	#leftLabelPad = 50
	#xAxisLabelOffset = 50
	#yAxisLabelX = 55

	settings: RunChart2Settings
	xMin = Infinity
	xMax = -Infinity
	yMin = Infinity
	yMax = -Infinity

	constructor(settings: RunChart2Settings) {
		this.settings = settings
	}

	/** Increase the domain slightly so all data points fit within the plot. */
	setDomain(min: number, max: number, percent = 0.1): [number, number] {
		const rangeInc = (max - min) * percent || 0.1
		return [min - rangeInc, max + rangeInc]
	}

	map(data: any) {
		let totalSampleCount = 0
		for (const series of data) {
			if (!series.points || series.points.length === 0) continue

			for (const point of series.points) {
				this.xMin = Math.min(point.x, this.xMin)
				this.xMax = Math.max(point.x, this.xMax)
				this.yMin = Math.min(point.y, this.yMin)
				this.yMax = Math.max(point.y, this.yMax)
				totalSampleCount += point.sampleCount ?? 0
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
			const xPadded = usePaddingX ? this.setDomain(this.xMin, this.xMax, 0.02) : null
			xMinForDomain = this.settings.minXScale ?? (xPadded ? xPadded[0] : this.xMin)
			xMaxForDomain = this.settings.maxXScale ?? (xPadded ? xPadded[1] : this.xMax)

			const usePaddingY = this.settings.minYScale == null && this.settings.maxYScale == null
			const yPadded = usePaddingY ? this.setDomain(this.yMin, this.yMax, 0.1) : null
			yMinForDomain = this.settings.minYScale ?? (yPadded ? yPadded[0] : this.yMin)
			yMaxForDomain = this.settings.maxYScale ?? (yPadded ? yPadded[1] : this.yMax)
		} else {
			xMinForDomain = 0
			xMaxForDomain = 1
			yMinForDomain = 0
			yMaxForDomain = 1
		}

		return {
			series: data,
			totalSampleCount: totalSampleCount > 0 ? totalSampleCount : undefined,
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
		return {
			svg: {
				height: this.settings.svgh + this.#vertPad + this.#bottomLabelPad,
				width: this.settings.svgw + this.#horizPad + this.#leftLabelPad
			},
			xAxis: {
				scale: scaleLinear().domain([xMin, xMax]).range([0, this.settings.svgw]),
				x: this.#horizPad + this.#leftLabelPad,
				y: this.settings.svgh + this.#vertPad,
				labelOffset: this.#xAxisLabelOffset
			},
			yAxis: {
				// range [svgh, 0]: y grows bottom-to-top
				scale: scaleLinear().domain([yMin, yMax]).range([this.settings.svgh, 0]),
				x: this.#horizPad + this.#leftLabelPad,
				y: this.#vertPad,
				labelX: this.#yAxisLabelX
			}
		}
	}
}
