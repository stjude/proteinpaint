import type { RunChartRequest, RunChartResponse } from '#types'
import { getNormalRoot } from '#filter'
import { dofetch3 } from '#common/dofetch'

export class RunChart2Model {
	runChart2: any
	charts: any[] = []
	chartData: RunChartResponse | null = null

	constructor(runChart2: any) {
		this.runChart2 = runChart2
	}

	async fetchData(config: any) {
		const opts = this.getRequestOpts(config)

		if (!opts.genome || !opts.dslabel) {
			throw new Error('RunChart2 requires genome and dslabel.')
		}

		const body = {
			genome: opts.genome,
			dslabel: opts.dslabel,
			filter: getNormalRoot(opts.filter),
			term: opts.term,
			term2: opts.term2,
			aggregation: opts.aggregation
		}
		const result: RunChartResponse = await dofetch3('termdb/runChart', { body })

		if (result['error']) throw new Error(`RunChart2Model.fetchData() failed: ${result['error']}`)

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
