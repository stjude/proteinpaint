import { Filter } from '../filter.js'
import { CategoricalTerm, CategoricalBaseQ } from './categorical.js'
import { ConditionTerm } from './condition.js'
import { NumericTerm } from './numeric.js'
import { GeneVariantTerm } from './geneVariant.js'
import { SampleLstTerm } from './samplelst.js'
import { SnpsTerm } from './snps.js'

/**
 * @param id      term.id for dictionary terms, undefined for non-dictionary terms
 * @params $id    client-computed deterministic unique identifier, to distinguish tw with the same term but different q, that are in the same payload
 */

/*** types supporting termwrapper q ***/

export type HiddenValues = {
	[index: string]: number
}

// TODO: replace BaseQ with MinBaseQ (see below)
// keeping BaseQ for now to not break old code
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

export type ValuesQ = CategoricalBaseQ & {
	type: 'values'
}

export type PredefinedGroupSettingQ = CategoricalBaseQ & {
	type: 'predefined-groupset'
	predefined_groupset_idx: number
}

export type CustomGroupSettingQ = CategoricalBaseQ & {
	type: 'custom-groupset'
	customset: BaseGroupSet
}

export type GroupSettingQ = ValuesQ | PredefinedGroupSettingQ | CustomGroupSettingQ

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
}

export type Term = BaseTerm &
	(NumericTerm | CategoricalTerm | ConditionTerm | GeneVariantTerm | SampleLstTerm | SnpsTerm)

export type ValuesGroup = {
	name: string
	type: 'values' | string // can remove boolean fallback once problematic js files are converted to .ts and can declare `type: 'values' as const`
	values: { key: number | string; label: string }[]
	uncomputable?: boolean // if true, do not include this group in computations
}

// TODO: determine if this is used
export type FilterGroup = {
	name: string
	type: 'filter'
	filter: Filter
}

export type GroupEntry = ValuesGroup | FilterGroup

export type BaseGroupSet = {
	groups: GroupEntry[]
}

type Groupset = {
	name: string
	is_grade?: boolean
	is_subcondition?: boolean
} & BaseGroupSet

export type EnabledTermGroupSetting = {
	disabled?: false | boolean // can remove boolean fallback once common.js is converted to .ts and can declare `disabled: false as const`
	lst: Groupset[]
}

export type TermGroupSetting =
	| EnabledTermGroupSetting
	| {
			/** disabled=false when groupsetting is not applicable for term (e.g., when term has only two categories) */
			disabled: true | boolean // can remove boolean fallback once common.js is converted to .ts and can declare `disabled: true as const`
			lst?: []
	  }

/*** types supporting termwrapper ***/

export type BaseTW = {
	id?: string
	$id?: string
	isAtomic?: true
	// plot-specific customizations that are applied to a tw copy
	// todo: should rethink these
	legend?: any
	settings?: {
		[key: string]: any
	}
}

/*** types supporting Term types ***/

export type Subconditions = {
	[index: string | number]: {
		label: string
	}
}

/*** other types ***/

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
