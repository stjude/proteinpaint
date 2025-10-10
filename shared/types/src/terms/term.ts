import type { Filter } from '../filter.js'
import type { ConditionTerm } from './condition.js'
import type { NumericTerm } from './numeric.js'
import type { GvTerm } from './geneVariant.js'
import type { SampleLstTerm } from './samplelst.js'
import type { SnpsTerm } from './snps.js'
import type { QualTerm } from './qualitative.ts'

/**
 * @param id      term.id for dictionary terms, undefined for non-dictionary terms
 * @params $id    client-computed deterministic unique identifier, to distinguish tw with the same term but different q, that are in the same payload
 */

/*** types supporting termwrapper term ***/

export type BaseValue = {
	key?: string
	uncomputable?: boolean
	label?: string | number
	order?: string
	color?: string
	group?: number
	filter?: Filter
}

export type TermValues = {
	[key: string | number]: BaseValue
}

export type BaseTerm = {
	id: string
	name: string
	type: string
	child_types?: string[]
	hashtmldetail?: boolean
	included_types?: string[]
	isleaf?: boolean
	values?: TermValues
	/** Do not build .values{} when building termdb. Used for 
	making categorical term with empty .values{} in TermdbTest */
	skipValuesBuild?: boolean
	valueConversion?: {
		fromUnit: string
		toUnit: string
		scaleFactor: string
	}
}

// NumericTerm includes integer, float, date, geneExpression, metaboliteIntensity, and other non-dict terms
export type Term = BaseTerm & (NumericTerm | ConditionTerm | SampleLstTerm | SnpsTerm | GvTerm | QualTerm)

/*** types supporting Term types ***/

export type Subconditions = {
	[index: string | number]: {
		label: string
	}
}
