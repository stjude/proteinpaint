import { TermWrapper, BaseQ, Term } from '../termdb.ts'
import { TermSettingInstance } from '../termsetting.ts'

/*
--------EXPORTED--------
GeneExpressionQ
GeneExpressionTermWrapper
GeneExpressionTermSettingInstance

*/

export type GeneExpressionQ = BaseQ & {
	// termType: 'GeneExpression'
	cnvGainCutoff?: number
	cnvMaxLength?: number
	cnvMinAbsValue?: number
	cnvLossCutoff?: number
	exclude: any //an array maybe?
	mode: 'continuous'
}

export type GeneExpressionTW = TermWrapper & {
	q: GeneExpressionQ
	term: GeneExpressionTerm
}

export type GeneExpressionTerm = Term & {
	gene?: string
	bins?: any
}

export type GeneExpressionTermSettingInstance = TermSettingInstance & {
	q: GeneExpressionQ
	term: GeneExpressionTerm
}
