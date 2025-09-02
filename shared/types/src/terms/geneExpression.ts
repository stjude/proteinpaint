import type { PresetNumericBins, NumericBaseTerm, NumTWTypes } from '../index.ts'

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

export type GeneExpressionTW = NumTWTypes & { term: GeneExpressionTerm }
