import type { PresetNumericBins, NumericBaseTerm, NumTW, RawNumTW } from '../index.ts'

/*
--------EXPORTED--------
GeneExpressionTerm
GeneExpressionTermWrapper
GeneExpressionTermSettingInstance
*/

export type GeneExpressionTerm = NumericBaseTerm & {
	type: 'geneExpression'
	gene: string
	bins?: PresetNumericBins
}

export type GeneExpressionTW = NumTW & { term: GeneExpressionTerm }

export type RawGeneExpTerm = GeneExpressionTerm & { name?: string }

export type RawGeneExpTW = RawNumTW & { term: RawGeneExpTerm }
