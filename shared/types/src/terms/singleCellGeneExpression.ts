import type { TermWrapper } from './tw.ts'
import type { GeneExpressionQ } from './geneExpression.ts'
import type { TermSettingInstance } from '../termsetting.ts'
import type { NumericTerm } from './numeric.ts'

/*
--------EXPORTED--------
GeneExpressionQ
GeneExpressionTermWrapper
GeneExpressionTermSettingInstance

*/

export type SingleCellGeneExpressionTW = TermWrapper & {
	q: GeneExpressionQ
	term: SingleCellGeneExpressionTerm
}

export type SingleCellGeneExpressionTerm = NumericTerm & {
	gene: string
	sample: string
}

export type SingleCellGeneExpressionTermSettingInstance = TermSettingInstance & {
	q: GeneExpressionQ
	term: SingleCellGeneExpressionTerm
}
