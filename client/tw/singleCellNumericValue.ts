import { type RawSingleCellNumValueTerm, type SingleCellNumericValueTerm, SINGLECELL_NUMERIC_VALUE } from '#types'
// import type { TwOpts } from './TwBase.ts'

const termType = SINGLECELL_NUMERIC_VALUE

export class SingleCellNumericValueBase {
    type = termType


    static fill(term: RawSingleCellNumValueTerm, /*opts: TwOpts*/) {
        if (term instanceof SingleCellNumericValueBase) return
        SingleCellNumericValueBase.validate(term)
        
    }

    static validate(term: RawSingleCellNumValueTerm) {
        if (!term || typeof term !== 'object') throw new Error('term is not an object')
        if (term.type != termType) throw new Error(`incorrect term.type='${term?.type}', expecting '${termType}'`)
    }

    constructor(term: RawSingleCellNumValueTerm | SingleCellNumericValueTerm, /*opts: TwOpts*/) {
        SingleCellNumericValueBase.validate(term)
    }
}
