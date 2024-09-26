import { TermWrapper } from './tw.ts'
import { BaseQ } from './term.ts'
import { TermSettingInstance } from '../termsetting.ts'
import { NumericTerm } from './numeric.ts'

/*
--------EXPORTED--------
GeneExpressionQ
GeneExpressionTermWrapper
GeneExpressionTermSettingInstance

*/

export type GeneExpressionQ = BaseQ & {
	mode: 'continuous'
}

export type SingleCellGeneExpressionTW = TermWrapper & {
	q: GeneExpressionQ
	term: SingleCellGeneExpressionTerm
}

export type SingleCellGeneExpressionTerm = NumericTerm & {
	gene: string
	sample: string
}

export type GeneExpressionTermSettingInstance = TermSettingInstance & {
	q: GeneExpressionQ
	term: SingleCellGeneExpressionTerm
}
