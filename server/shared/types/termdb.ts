import { Tvs, Filter } from './filter'
import { CategoricalQ } from './terms/categorical'
import { ConditionQ } from './terms/condition'
import { NumericQ } from './terms/numeric'
import { GeneVariantQ } from './terms/geneVariant'
import { SampleLstQ } from './terms/samplelst'
import { SnpsQ } from './terms/snps'

/*
--------EXPORTED--------
RangeEntry
GroupEntry
BaseGroupSet
GroupSetEntry
GroupSetting
BaseQ
Q
TermValues
Subconditions
Term
DetermineQ
TermWrapper
TWDynamicQ

*/

/*** types supporting Q type ***/

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

export type GroupEntry = {
	name: string
	/** 'filter' is no longer used!! Only use values */
	type?: 'values' | 'filter'
	color?: string
	values: { key: number | string; label: string }[]
	filter?: Filter
}

export type BaseGroupSet = {
	groups: GroupEntry[]
}

export type GroupSetEntry = BaseGroupSet & {
	name?: string
	is_grade?: boolean
	is_subcondition?: boolean
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
	groups?: any // Not documented but appears in condition and samplelst?? same as groupsetting?
	groupsetting?: GroupSetting
	/**Automatically set by fillTermWrapper()
	Applies to barchart, survival plot, and cuminc plot.
	Contains categories of a term to be hidden in its chart. This should only apply to client-side rendering, and should not be part of “dataName” when requesting data from server. Server will always provide a summary for all categories. It’s up to the client to show/hide categories.
	This allows the key visibility to be stored in state, while toggling visibility will not trigger data re-request.
	Currently termsetting menu does not manage this attribute. It’s managed by barchart legend.
	*/
	hiddenValues?: HiddenValues
	/**indicates this object should not be extended by a copy-merge tool */
	isAtomic?: boolean
	/** Describes list of custom bins. */
	lst?: RangeEntry[]
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

export type Q = BaseQ | CategoricalQ | ConditionQ | NumericQ | GeneVariantQ | SampleLstQ | SnpsQ

/*** types supporting Term types ***/

export type TermValues = {
	[index: string | number]: {
		uncomputable?: boolean
		label?: string | number
		order?: string
		color?: string
		group?: number
		key?: string
		filter?: Filter
	}
}

export type Subconditions = {
	[index: string | number]: {
		label: string
	}
}

type ValueConversion = {
	/**name of unit for the original value */
	fromUnit: string
	/** name of converted unit.
	when converting day to year, resulting value will be `X year Y day`, that the fromUnit is used to indicate residue days from the last year; it's also printed in termsetting ui
	this logic does not hold if converting from year to day, should detect if scaleFactor is >1 or <1 */
	toUnit: string
}

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

export type TermWrapper = {
	//Term wrapper aka. term:{term:{...}, q:{...}...}
	id?: string
	$id?: string
	isAtomic?: boolean
	term: Term
	q: Q
}

export type TWDynamicQ = TermWrapper & { q: DetermineQ<TermWrapper['term']['type']> }
