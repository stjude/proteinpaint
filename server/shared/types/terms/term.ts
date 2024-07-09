import { Filter } from '../filter.ts'
import { CategoricalQ, CategoricalTerm } from './categorical.ts'
import { ConditionQ, ConditionTerm } from './condition.ts'
import { NumericQ, NumericTerm } from './numeric.ts'
import { GeneVariantQ, GeneVariantTerm } from './geneVariant.ts'
import { SampleLstQ, SampleLstTerm } from './samplelst.ts'
import { SnpsQ, SnpsTerm } from './snps.ts'
import { Q } from './tw.ts'
import { PresetNumericBins } from './numeric.ts'

/**
 * @param id      term.id for dictionary terms, undefined for non-dictionary terms
 * @params $id    client-generated random unique identifier, to distinguish tw with the same term but different q, that are in the same payload
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
	color?: string
	groupsetting: EmptyGroupSetting
}

export type FilterGroup = {
	name: string
	type: 'filter'
	filter?: Filter
}

export type GroupEntry = ValuesGroup | FilterGroup

export type BaseGroupSet = {
	groups: GroupEntry[]
}

export type GroupSetEntry = BaseGroupSet & {
	name?: string
	is_grade?: boolean
	is_subcondition?: boolean
}

export type CustomGroupSetting = {
	/** When “predefined_groupset_idx” is undefined, will use this set of groups.
	This is a custom set of groups either copied from predefined set, or created with UI.
	Custom set definition is the same as a predefined set. */
	customset: BaseGroupSet
	disabled?: boolean
	inuse?: boolean
	lst?: GroupSetEntry[] // quick-fix
}

export type PredefinedGroupSetting = {
	/** If true, apply and will require the following attributes */
	inuse?: boolean
	disabled?: boolean
	useIndex?: number
	/**Value is array index of term.groupsetting.lst[] */
	predefined_groupset_idx: number
	lst: GroupSetEntry[]
}

export type EmptyGroupSetting = {
	inuse?: false
	disabled?: true
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
	groupsetting: PredefinedGroupSetting | CustomGroupSetting | EmptyGroupSetting
	bins?: PresetNumericBins
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

export type GroupSetting = {
	/** If true, apply and will require the following attributes */
	inuse?: boolean
	disabled?: boolean
	useIndex?: number
	/**Value is array index of term.groupsetting.lst[] */
	predefined_groupset_idx?: number
	lst?: GroupSetEntry[]
	/** When “predefined_groupset_idx” is undefined, will use this set of groups.
	This is a custom set of groups either copied from predefined set, or created with UI.
	Custom set definition is the same as a predefined set. */
	customset?: BaseGroupSet
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
		/** Applies to categorical and condition terms */
		| 'predefined-groupset'
		/** Applies to categorical and condition terms */
		| 'custom-groupset'
		| 'custom-samplelst'
}

/*** types supporting Term types ***/

export type Subconditions = {
	[index: string | number]: {
		label: string
	}
}

// TODO: remove, not needed?
//type ValueConversion = {
/** name of unit for the original value */
//fromUnit: string
/** name of converted unit.
	when converting day to year, resulting value will be `X year Y day`, that the fromUnit is used to indicate residue days from the last year; it's also printed in termsetting ui
	this logic does not hold if converting from year to day, should detect if scaleFactor is >1 or <1 */
//toUnit: string
//}

export type DetermineQ<T extends Term['type']> = T extends 'numeric' | 'integer' | 'float'
	? NumericQ
	: T extends 'categorical'
	? CategoricalQ
	: T extends 'condition'
	? ConditionQ
	: T extends 'geneVariant'
	? GeneVariantQ
	: T extends 'samplelst'
	? SampleLstQ
	: T extends 'snplst' | 'snplocus'
	? SnpsQ
	: Q
