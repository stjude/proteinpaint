import type { PresetNumericBins, NumericBaseTerm, NumTW, RawNumTW } from '../index.ts'

export type ScgeGene = {
	kind?: 'gene'
	gene: string
	chr?: string
	start?: number
	stop?: number
}

// export type ScgeCoord = {
// 	kind?: 'coord'
// 	gene?: string
// 	chr: string
// 	start: number
// 	stop: number
// }

export type SingleCellGeneExpressionTerm = NumericBaseTerm & {
	type: 'singleCellGeneExpression'
	gene?: string
	genes: ScgeGene[]
	sample: string
	unit: string
	bins?: PresetNumericBins
}

export type SingleCellGeneExpressionTermTW = NumTW & { term: SingleCellGeneExpressionTerm }

export type RawSingleCellGeneExpTerm = SingleCellGeneExpressionTerm & { name?: string }

export type RawSingleCellGeneExpTW = RawNumTW & { term: RawSingleCellGeneExpTerm }
