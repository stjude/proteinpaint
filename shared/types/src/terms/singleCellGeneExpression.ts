import type { TermWrapper } from './tw.ts'
import type { TermSettingInstance } from '../termsetting.ts'
import type { NumericTerm, NumericQ } from './numeric.ts'

/*
--------EXPORTED--------
GeneExpressionQ
GeneExpressionTermWrapper
GeneExpressionTermSettingInstance

*/

export type SingleCellGeneExpressionTW = TermWrapper & {
	q: NumericQ
	term: SingleCellGeneExpressionTerm
}

export type SingleCellGeneExpressionTerm = NumericTerm & {
	gene: string
	sample: string
}

export type SingleCellGeneExpressionTermSettingInstance = TermSettingInstance & {
	q: NumericQ
	term: SingleCellGeneExpressionTerm
}
