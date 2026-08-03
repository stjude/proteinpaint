import type { AggregateMatrix } from '../AggregateMatrix.ts'

export class AggMatrixView {
    ag: AggregateMatrix

    constructor(ag: AggregateMatrix) {
        this.ag = ag
    }
}