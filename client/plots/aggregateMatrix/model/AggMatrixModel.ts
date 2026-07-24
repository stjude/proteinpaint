import { type AggregateMatrix, validatePlotConfig } from '../AggregateMatrix.ts'
import type { AppApi } from '#rx'

export class AggMatrixModel {
    ag: AggregateMatrix
    app: AppApi

    constructor(ag: AggregateMatrix) {
        this.ag = ag
        this.app = ag.app
    }

    async getData() {
        const state = this.ag.state
        const config = state.config
        
        validatePlotConfig(config)

        const body = {
            entries: config.entries,
            categories: config.categories,
            gradientMethod: config.gradientMethod,
            sizeMethod: config.sizeMethod,
            filter: state.termfilter.filter,
            filter0: state.termfilter.filter0,
            signal: this.ag.api?.getAbortSignal()
        }

        return await this.app.vocabApi.getAggregateMatrixData(body)

    }
}