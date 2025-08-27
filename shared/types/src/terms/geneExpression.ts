import type { BaseTW, PresetNumericBins, NumericBaseTerm, NumericQ } from '../index.ts'
import type { TermSettingInstance } from '../termsetting.ts'

/*
--------EXPORTED--------
GeneExpressionTerm
GeneExpressionTermWrapper
GeneExpressionTermSettingInstance
*/

export type GeneExpressionTerm = NumericBaseTerm & {
	gene: string
	name: string
	type: 'geneExpression'
	bins?: PresetNumericBins
	// temporarily allowing chr/start/stop to support
	// legacy fpkm files
	chr?: string
	start?: number
	stop?: number
}

export type GeneExpressionTW = BaseTW & {
	q: NumericQ
	term: GeneExpressionTerm
	type: string
}

export type GeneExpressionTermSettingInstance = TermSettingInstance & {
	q: NumericQ
	term: GeneExpressionTerm
}
