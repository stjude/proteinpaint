// import type { BaseTerm } from '../index.ts'
import type { PresetNumericBins, NumericBaseTerm, NumTW, RawNumTW } from '../index.ts'

type Gene = {
	kind?: 'gene'
	gene: string
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

export type SingleCellGeneExpressionTerm = NumericBaseTerm & {
	type: 'singleCellGeneExpression'
	gene: string
	// sample: string
	unit: string
	bins?: PresetNumericBins
} & (Gene | Coord)

export type SingleCellGeneExpressionTermTW = NumTW & { term: SingleCellGeneExpressionTerm }

export type RawSingleCellGeneExpTerm = SingleCellGeneExpressionTerm & { name?: string }

export type RawSingleCellGeneExpTW = RawNumTW & { term: RawSingleCellGeneExpTerm }
