import type { PresetNumericBins, NumericBaseTerm, NumTW, RawNumTW } from '../index.ts'

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

export type GeneExpressionTW = NumTW & { term: GeneExpressionTerm }

type RawGeneExpTermByGene = {
	type: 'geneExpression'
	gene: 'string'
}

type RawGeneExpTermByPosition = {
	type: 'geneExpression'
	chr: string
	start: number
	stop: number
}

type RawGeneExpTerm = RawGeneExpTermByGene | RawGeneExpTermByPosition

export type RawGeneExpTW = RawNumTW & { term: RawGeneExpTerm }
