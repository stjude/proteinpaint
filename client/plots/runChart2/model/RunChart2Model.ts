import type { RunChartRequest, RunChartResponse } from '#types'
import { dofetch3 } from '#common/dofetch'

export class RunChart2Model {
	runChart2: any
	charts: any[] = []
	chartData: RunChartResponse | null = null

	constructor(runChart2: any) {
		this.runChart2 = runChart2
	}

	async fetchData(config: any) {
		const body = this.getRequestOpts(config)
		const result: RunChartResponse = await dofetch3('termdb/runChart', { body })
		if (result['error']) throw new Error(`RunChart2Model.getData() failed: ${result['error']}`)

		return result.series
	}

	getRequestOpts(config: any): RunChartRequest {
		const state = this.runChart2.state
		return {
			genome: state.vocab.genome,
			dslabel: state.vocab.dslabel,
			filter: state.termfilter.filter,
			term: config.term,
			term2: config.term2,
			aggregation: config.settings.runChart2.aggregation
		}
	}
}
