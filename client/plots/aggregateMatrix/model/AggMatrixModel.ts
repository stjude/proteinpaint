import { type AggregateMatrix, validatePlotConfig } from '../AggregateMatrix.ts'
import type { AppApi } from '#rx'
import { isPieOnly } from '#shared/aggregateMatrix.js'

export class AggMatrixModel {
	ag: AggregateMatrix
	app: AppApi

	constructor(ag: AggregateMatrix) {
		this.ag = ag
		this.app = ag.app
	}

	async getData() {
		const state = this.ag.state
		const config = structuredClone(state.config)

		validatePlotConfig(config)

		const settings = config.settings.aggregateMatrix || {}

		const body = {
			rows: config.rows,
			columns: config.columns,
			// not needed when every dot is a pie
			gradientMethod: isPieOnly(config.rows, config.columns) ? undefined : settings.gradientMethod,
			sizeMethod: settings.sizeMethod,
			minDotSize: settings.minDotSize,
			maxDotSize: settings.maxDotSize,
			filter: state.termfilter.filter,
			filter0: state.termfilter.filter0,
			signal: this.ag.api?.getAbortSignal()
		}

		return await this.app.vocabApi.getAggregateMatrixData(body)
	}
}
