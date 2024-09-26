import { TermWrapper } from './tw.ts'
import { BaseQ } from './term.ts'
import { GeneExpressionQ } from './geneExpression'
import { TermSettingInstance } from '../termsetting.ts'
import { NumericTerm } from './numeric.ts'

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
