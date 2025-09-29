import type { PresetNumericBins, NumericBaseTerm, NumTW, RawNumTW } from '../index.ts'

/*
--------EXPORTED--------
GeneExpressionTerm
GeneExpressionTermWrapper
GeneExpressionTermSettingInstance
*/

type Gene = {
	kind?: 'gene'
	gene: string
	// chr,start,stop should exist together as a separate type called
	// 'Coord', but hard to code as atomic `& Coord` because it may
	// need to be filled in
	chr?: string
	start?: number
	stop?: number
}

type Coord = {
	kind?: 'coord'
	gene?: string
	chr: string
	start: number
	stop: number
}

export type GeneExpressionTerm = NumericBaseTerm & {
	type: 'geneExpression'
	bins?: PresetNumericBins
} & (Gene | Coord)

export type GeneExpressionTW = NumTW & { term: GeneExpressionTerm }

export type RawGeneExpTerm = GeneExpressionTerm & { name?: string }

export type RawGeneExpTW = RawNumTW & { term: RawGeneExpTerm }
