import type { RunChartRequest, RunChartResponse, RunChartErrorResponse, RunChartSuccessResponse } from '#types'
import { getNormalRoot } from '#filter'
import { dofetch3 } from '#common/dofetch'

export class RunChart2Model {
	runChart2: any
	charts: any[] = []
	chartData: RunChartSuccessResponse | null = null

	constructor(runChart2: any) {
		this.runChart2 = runChart2
	}

	async fetchData(config: any) {
		const result: RunChartResponse = await dofetch3('termdb/runChart', { body: this.getRequestOpts(config) })

		if (!('status' in result) || result.status !== 'ok') {
			throw new Error(`RunChart2Model.fetchData() failed: ${(result as RunChartErrorResponse).error}`)
		}

		return result.series
	}

	getRequestOpts(config: any): RunChartRequest {
		const state = this.runChart2.state
		return {
			genome: state.vocab.genome,
			dslabel: state.vocab.dslabel,
			filter: getNormalRoot(state.termfilter?.filter),
			xtw: config.xtw,
			ytw: config.ytw,
			aggregation: config.settings?.runChart2?.aggregation,
			showCumulativeFrequency: config.settings?.runChart2?.showCumulativeFrequency
		}
	}
}
