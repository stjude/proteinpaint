import type { PresetNumericBins, NumericBaseTerm, NumTW, RawNumTW } from '../index.ts'

export type SingleCellGeneExpressionTerm = NumericBaseTerm & {
	type: 'singleCellGeneExpression'
	gene: string
	sample: string
	unit: string
	bins?: PresetNumericBins
}

export type SingleCellGeneExpressionTermTW = NumTW & { term: SingleCellGeneExpressionTerm }

export type RawSingleCellGeneExpTerm = SingleCellGeneExpressionTerm & { name?: string }

export type RawSingleCellGeneExpTW = RawNumTW & { term: RawSingleCellGeneExpTerm }
