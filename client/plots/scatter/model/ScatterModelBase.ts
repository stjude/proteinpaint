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
	range: any
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
}
