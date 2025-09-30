import type { NumericBaseTerm, NumericQ, PresetNumericBins, NumTW, RawNumTW } from './numeric.ts'

/*
duplicated from geneExpression.ts
*/

export type SsGSEAQ = NumericQ & { dt?: number }

export type SsGSEATerm = NumericBaseTerm & {
	/** term.id: geneset db term id for native term, and cache file name for custom term */
	/** term.name: geneset db term name for native term, and user-defined name for custom term */
	/** custom term has list of gene names used for computing score */
	genes?: string[]
	name: string
	type: 'ssGSEA'
	bins?: PresetNumericBins
	unit?: string
}

export type RawSsGSEATerm = SsGSEATerm & {
	name?: string
}

export type SsGSEATW = NumTW & { term: SsGSEATerm }

export type RawSsGSEATW = RawNumTW & { term: SsGSEATerm }
