import type { AggregateMatrix } from '../AggregateMatrix.ts'

export class AggMatrixViewModel {
    ag: AggregateMatrix

    constructor(ag: AggregateMatrix){
        this.ag = ag
    }
}