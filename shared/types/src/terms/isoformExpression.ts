import type { PresetNumericBins, NumericBaseTerm, NumTW, RawNumTW } from '../index.ts'

/*
--------EXPORTED--------
IsoformExpressionTerm
IsoformExpressionTermWrapper
*/

export type IsoformExpressionTerm = NumericBaseTerm & {
	type: 'isoformExpression'
	isoform: string
	gene: string
	bins?: PresetNumericBins
}

export type IsoformExpressionTW = NumTW & { term: IsoformExpressionTerm }

export type RawIsoformExpTerm = IsoformExpressionTerm & { name?: string }

export type RawIsoformExpTW = RawNumTW & { term: RawIsoformExpTerm }
