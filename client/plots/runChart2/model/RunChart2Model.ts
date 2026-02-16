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
		const opts = this.getRequestOpts(config)

		if (!opts.genome || !opts.dslabel) {
			throw new Error('RunChart2 requires genome and dslabel.')
		}

		const body: any = {
			genome: opts.genome,
			dslabel: opts.dslabel,
			filter: getNormalRoot(opts.filter ?? undefined),
			xtw: opts.xtw,
			ytw: opts.ytw,
			aggregation: opts.aggregation,
			showCumulativeFrequency: opts.showCumulativeFrequency
		}
		const result: RunChartResponse = await dofetch3('termdb/runChart', { body })

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
			filter: state.termfilter?.filter,
			xtw: config.xtw,
			ytw: config.ytw,
			aggregation: config.settings?.runChart2?.aggregation,
			showCumulativeFrequency: config.settings?.runChart2?.showCumulativeFrequency === true
		}
	}
}
