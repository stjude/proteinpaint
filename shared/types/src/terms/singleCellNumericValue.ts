import type { PresetNumericBins, NumericBaseTerm, NumTW, RawNumTW } from '../index.ts'

export type SingleCellNumericValueTerm = NumericBaseTerm & {
    type: 'singleCellNumericValue'
    bins?: PresetNumericBins
    sample: any
    plot: string
}

export type SingleCellNumValueTermTW = NumTW & { term: SingleCellNumericValueTerm }

export type RawSingleCellNumValueTerm = SingleCellNumericValueTerm & { name?: string }

export type RawSingleCellNumValueTW = RawNumTW & { term: RawSingleCellNumValueTerm }