import type { PresetNumericBins, NumericBaseTerm, NumTW, RawNumTW } from '../index.ts'

/*
--------EXPORTED--------
IsoformExpressionTerm
IsoformExpressionTermWrapper
*/

type Isoform = {
	kind?: 'isoform'
	isoform: string
	gene?: string
	chr?: string
	start?: number
	stop?: number
}

type Coord = {
	kind?: 'coord'
	isoform?: string
	gene?: string
	chr: string
	start: number
	stop: number
}

export type IsoformExpressionTerm = NumericBaseTerm & {
	type: 'isoformExpression'
	bins?: PresetNumericBins
} & (Isoform | Coord)

export type IsoformExpressionTW = NumTW & { term: IsoformExpressionTerm }

export type RawIsoformExpTerm = IsoformExpressionTerm & { name?: string }

export type RawIsoformExpTW = RawNumTW & { term: RawIsoformExpTerm }
