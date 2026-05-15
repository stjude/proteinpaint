import type { Scatter } from '../scatter'
import type { ColorLegendItem, ScatterChart, ScatterDataResult, ShapeLegendItem } from '../scatterTypes'
import { maxSvgSamplesCutoff } from '../settings/defaults'
import type { SingleCellPlotDataResult } from '#types'

export class ScatterModelBase {
	scatter: Scatter
	charts: ScatterChart[]
	is3D: boolean
	is2DLarge: boolean
	axisOffset: { x: number; y: number }
	startGradient: any
	stopGradient: any
	range!: {
		xMin: number
		xMax: number
		yMin: number
		yMax: number
		scaleMin?: number
		scaleMax?: number
		geMin?: number
		geMax?: number
	}
	filterSampleStr: string | null = null

	constructor(scatter: Scatter) {
		this.scatter = scatter

		this.is3D = false
		this.is2DLarge = false
		this.axisOffset = { x: 80, y: 30 }

		this.charts = []
	}

	createChart(id: string, data: ScatterDataResult | SingleCellPlotDataResult) {
		const cohortSamples: any[] = data.samples ? data.samples.filter(sample => 'sampleId' in sample) : []
		if (cohortSamples.length > maxSvgSamplesCutoff) this.is2DLarge = true
		const colorLegend: Map<string, ColorLegendItem> = new Map(data.colorLegend)
		const shapeLegend: Map<string, ShapeLegendItem> = new Map(data.shapeLegend)
		const chart: ScatterChart = { id, data, cohortSamples, colorLegend, shapeLegend }
		if (data.src) {
			chart.src = data.src
			this.is2DLarge = true
		}
		this.charts.push(chart)
	}

	async initRanges() {
		const settings = this.scatter.settings
		let samples: any[] = []
		for (const chart of this.charts) samples = samples.concat(chart.data?.samples || [])
		if (samples.length == 0) {
			if (this.scatter.config.singleCellPlot) {
				this.charts[0].ranges = {
					xMin: settings.minXScale != null ? settings.minXScale : this.range.xMin,
					xMax: settings.maxXScale != null ? settings.maxXScale : this.range.xMax,
					yMin: settings.minYScale != null ? settings.minYScale : this.range.yMin,
					yMax: settings.maxYScale != null ? settings.maxYScale : this.range.yMax,
					geMin: this.range.geMin,
					geMax: this.range.geMax
				}
			}
			return
		}
		if (samples.length > maxSvgSamplesCutoff) this.is2DLarge = true
		const s0 = samples[0] //First sample to start reduce comparisons
		const [xMin, xMax, yMin, yMax, zMin, zMax, scaleMin, scaleMax, geMin, geMax] = samples.reduce(
			(s, d) => [
				d.x < s[0] ? d.x : s[0],
				d.x > s[1] ? d.x : s[1],
				d.y < s[2] ? d.y : s[2],
				d.y > s[3] ? d.y : s[3],
				d.z < s[4] ? d.z : s[4],
				d.z > s[5] ? d.z : s[5],
				'scale' in d ? (d.scale < s[6] ? d.scale : s[6]) : Number.POSITIVE_INFINITY,
				'scale' in d ? (d.scale > s[7] ? d.scale : s[7]) : Number.NEGATIVE_INFINITY,
				'geneExp' in d ? (d.geneExp < s[8] ? d.geneExp : s[8]) : Number.POSITIVE_INFINITY,
				'geneExp' in d ? (d.geneExp > s[9] ? d.geneExp : s[9]) : Number.NEGATIVE_INFINITY
			],
			[s0.x, s0.x, s0.y, s0.y, s0.z, s0.z, s0.scale, s0.scale, s0.geneExp, s0.geneExp]
		)
		for (const chart of this.charts) {
			chart.ranges = {
				xMin: settings.minXScale != null ? settings.minXScale : settings.useGlobalMinMax ? this.range.xMin : xMin,
				xMax: settings.maxXScale != null ? settings.maxXScale : settings.useGlobalMinMax ? this.range.xMax : xMax,
				yMin: settings.minYScale != null ? settings.minYScale : settings.useGlobalMinMax ? this.range.yMin : yMin,
				yMax: settings.maxYScale != null ? settings.maxYScale : settings.useGlobalMinMax ? this.range.yMax : yMax,
				zMin,
				zMax,
				scaleMin,
				scaleMax,
				geMin,
				geMax
			}
		}
	}
}
