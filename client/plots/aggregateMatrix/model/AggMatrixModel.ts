import type { AggregateMatrix } from '../AggregateMatrix.ts'
import type { AppApi } from '#rx'

export class AggMatrixModel {
    ag: AggregateMatrix
    app: AppApi

    constructor(ag: AggregateMatrix) {
        this.ag = ag
        this.app = ag.app
    }

    async getData() {
        const state = this.app.getState()

        const body = {
            filter: state.termfilter.filter,
            filter0: state.termfilter.filter0,
            signal: this.ag.api?.getAbortSignal()
        }

        return await this.app.vocabApi.getAggregateMatrixData(body)

    }
}