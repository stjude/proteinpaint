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
        const config = structuredClone(state.config)
        
        validatePlotConfig(config)

        const body = {
            entries: config.entries,
            categories: config.categories,
            gradientMethod: config.settings.gradientMethod,
            sizeMethod: config.settings.sizeMethod,
            minDotSize: config.settings.minDotSize,
            maxDotSize: config.settings.maxDotSize,
            filter: state.termfilter.filter,
            filter0: state.termfilter.filter0,
            signal: this.ag.api?.getAbortSignal()
        }

        return await this.app.vocabApi.getAggregateMatrixData(body)
    }
}