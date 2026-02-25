import type { BaseTerm } from '../index.ts'

export type SingleCellGeneExpressionTerm = BaseTerm & {
	type: 'singleCellGeneExpression'
	gene: string
	sample: string
}

export type RawSingleCellGeneExpressionTerm = SingleCellGeneExpressionTerm & {
	//Not sure what should go here yet
}
