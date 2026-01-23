import type { RunChart2 } from '../RunChart2.ts'
import type { RunChartResponse } from '#types'

export type ChartData = {
	id: string
	series: {
		median: number
		points: Array<{
			x: number
			xName: string
			y: number
			sampleCount: number
		}>
	}
}

export class RunChart2Model {
	runChart2: RunChart2
	charts: ChartData[] = []
	chartData: RunChartResponse | null = null

	constructor(runChart2: RunChart2) {
		this.runChart2 = runChart2
	}

	async initData() {
		const requestArg = await this.runChart2.getRequestArg()
		const response = await this.runChart2.fetchData(requestArg)
		this.chartData = response
		return response
	}

	processData() {
		if (!this.chartData || this.chartData.status !== 'ok' || !this.chartData.series) {
			return
		}

		this.charts = []
		for (let i = 0; i < this.chartData.series.length; i++) {
			const series = this.chartData.series[i]
			this.charts.push({
				id: `series-${i}`,
				series
			})
		}
	}
}
