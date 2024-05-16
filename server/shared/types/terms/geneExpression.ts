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

export type GeneExpressionTW = TermWrapper & {
	q: GeneExpressionQ
	term: GeneExpressionTerm
}

export type GeneExpressionTerm = NumericTerm & {
	gene: string
}

export type GeneExpressionTermSettingInstance = TermSettingInstance & {
	q: GeneExpressionQ
	term: GeneExpressionTerm
}
