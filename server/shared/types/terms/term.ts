import { Filter } from '../filter.ts'
import { CategoricalTerm } from './categorical.ts'
import { ConditionTerm } from './condition.ts'
import { NumericTerm } from './numeric.ts'
import { GeneVariantTerm } from './geneVariant.ts'
import { SampleLstTerm } from './samplelst.ts'
import { SnpsTerm } from './snps.ts'

/**
 * @param id      term.id for dictionary terms, undefined for non-dictionary terms
 * @params $id    client-computed deterministic unique identifier, to distinguish tw with the same term but different q, that are in the same payload
 */
export type BaseTW = {
	id?: string
	$id?: string
	isAtomic?: true
}

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

export type ValuesGroup = {
	name: string
	type: 'values'
	values: { key: number | string; label: string }[]
	uncomputable?: boolean // if true, do not include this group in computations
}

export type FilterGroup = {
	name: string
	type: 'filter'
	filter: Filter
}

export type GroupEntry = ValuesGroup | FilterGroup

type CustomSet = {
	groups: GroupEntry[]
}

type Groupset = {
	name: string
	is_grade?: boolean
	is_subcondition?: boolean
	groups: GroupEntry[]
}

export type UnusedQGroupSetting = {
	inuse: false
}

export type CustomQGroupSetting = {
	/** When “predefined_groupset_idx” is undefined, will use this set of groups.
	This is a custom set of groups either copied from predefined set, or created with UI.
	Custom set definition is the same as a predefined set. */
	type: 'custom'
	customset: CustomSet
	/**  if false, not applied */
	inuse: true
}

export type PredefinedQGroupSetting = {
	/** If .inuse true, apply and will require predefined_groupset_idx */
	/** Value is array index of term.groupsetting.lst[] */
	type: 'predefined'
	predefined_groupset_idx: number
	inuse: true
}

export type QGroupSetting = UnusedQGroupSetting | CustomQGroupSetting | PredefinedQGroupSetting

export type TermGroupSetting = {
	/** if there are only two categories, means groupsetting
	 * definition is not applicable for the term */
	disabled?: boolean
	lst: Groupset[]
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
}
export type Term = BaseTerm &
	(NumericTerm | CategoricalTerm | ConditionTerm | GeneVariantTerm | SampleLstTerm | SnpsTerm)

type HiddenValues = {
	[index: string]: number
}

export type RangeEntry = {
	//Used binconfig.lst[] and in tvs.ranges[]
	start?: number
	startunbounded?: boolean
	startinclusive?: boolean
	stop?: number
	stopunbounded?: boolean
	stopinclusive?: boolean
	label?: string //for binconfig.lst[]
	value?: string //for tvs.ranges[]
	range?: any //No idea what this is
}

export type BaseQ = {
	/**Automatically set by fillTermWrapper()
	Applies to barchart, survival plot, and cuminc plot.
	Contains categories of a term to be hidden in its chart. This should only apply to client-side rendering, and should not be part of “dataName” when requesting data from server. Server will always provide a summary for all categories. It’s up to the client to show/hide categories.
	This allows the key visibility to be stored in state, while toggling visibility will not trigger data re-request.
	Currently termsetting menu does not manage this attribute. It’s managed by barchart legend.
	*/
	hiddenValues?: HiddenValues
	/**indicates this object should not be extended by a copy-merge tool */
	isAtomic?: boolean
	name?: string
	mode?:
		| 'discrete'
		/** Binary is a special case of discrete. */
		| 'binary'
		| 'continuous'
		/** Only for numeric terms in regression analysis. Requires q.knots */
		| 'spline'
		/** Only applies to condition term. Requires q.breaks[] to have one grade value.*/
		| 'cuminc'
		/** Only applies to condition term for cox regression outcome. Requires q.breaks[] to have one grade value, for event and q.timeScale.*/
		| 'cox'

	reuseId?: string
	/** To define ways to divide up cohort based on a term, using methods specific to term types.*/
	type?: /** Requires term.values{} to access categories for categorical term, and grade for condition term */
	| 'values'
		/** Applies to numeric terms */
		| 'regular-bin'
		/** Applies to numeric terms */
		| 'custom-bin'
		/** Applies to categorical, condition, geneVariant, and singleCellCellType terms */
		| 'predefined-groupset'
		/** Applies to categorical, condition, geneVariant, and singleCellCellType terms */
		| 'custom-groupset'
		/** Applies to samplelst terms */
		| 'custom-samplelst'
}

/*** types supporting Term types ***/

export type Subconditions = {
	[index: string | number]: {
		label: string
	}
}
