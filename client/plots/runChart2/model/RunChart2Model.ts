import type { RunChartRequest, RunChartResponse, RunChartSuccessResponse } from '#types'
import { isRunChartSuccess } from '#types'
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
			...(opts.ytw != null && { ytw: opts.ytw }),
			...(opts.ytw != null && { aggregation: opts.aggregation ?? 'median' }),
			...(opts.ytw == null && opts.showCumulativeFrequency === true && { showCumulativeFrequency: true })
		}
		const result: RunChartResponse = await dofetch3('termdb/runChart', { body })

		if (!isRunChartSuccess(result)) {
			throw new Error(`RunChart2Model.fetchData() failed: ${result.error}`)
		}

		return result.series
	}

	getRequestOpts(config: any): RunChartRequest {
		const state = this.runChart2.state
		const opts: RunChartRequest = {
			genome: state.vocab.genome,
			dslabel: state.vocab.dslabel,
			filter: state.termfilter?.filter,
			xtw: config.xtw,
			...(config.ytw != null && {
				ytw: config.ytw,
				aggregation: config.settings.runChart2.aggregation
			}),
			...(config.ytw == null && {
				showCumulativeFrequency: config.settings?.runChart2?.showCumulativeFrequency === true
			})
		}
		return opts
	}
}
