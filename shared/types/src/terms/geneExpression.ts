import type { TermWrapper } from './tw.ts'
import type { NumericTerm, NumericQ } from './numeric.ts'
import type { TermSettingInstance } from '../termsetting.ts'

/*
--------EXPORTED--------
GeneExpressionQ
GeneExpressionTermWrapper
GeneExpressionTermSettingInstance

*/

export type GeneExpressionQ = NumericQ & { dt?: number }

export type GeneExpressionTW = TermWrapper & {
	q: GeneExpressionQ
	term: GeneExpressionTerm
}

export type GeneExpressionTerm = NumericTerm & {
	gene: string
	// temporarily allowing chr/start/stop to support
	// legacy fpkm files
	chr?: string
	start?: number
	stop?: number
}

export type GeneExpressionTermSettingInstance = TermSettingInstance & {
	q: GeneExpressionQ
	term: GeneExpressionTerm
}
