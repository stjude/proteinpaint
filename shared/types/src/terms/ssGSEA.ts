import type { TermWrapper } from './tw.ts'
import type { NumericBaseTerm, NumericQ, PresetNumericBins } from './numeric.ts'
import type { TermSettingInstance } from '../termsetting.ts'

/*
duplicated from geneExpression.ts
*/

export type SsGSEAQ = NumericQ & { dt?: number }

export type SsGSEATW = TermWrapper & {
	q: SsGSEAQ
	term: SsGSEATerm
}

export type SsGSEATerm = NumericBaseTerm & {
	/** term.id: geneset db term id for native term, and cache file name for custom term */
	/** term.name: geneset db term name for native term, and user-defined name for custom term */
	/** custom term has list of gene names used for computing score */
	genes?: string[]
	name?: string
	type: 'date'
	metabolite: string
	bins: PresetNumericBins
	unit?: string
}

export type SsGSEATermSettingInstance = TermSettingInstance & {
	q: SsGSEAQ
	term: SsGSEATerm
}
