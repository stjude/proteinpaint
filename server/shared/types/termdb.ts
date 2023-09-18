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
	type?: 'values' | 'filter' //filter is no longer used. Only use values
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
	inuse?: boolean
	disabled?: boolean
	useIndex?: number
	predefined_groupset_idx?: number
	lst?: GroupSetEntry[]
	customset?: BaseGroupSet
}

export type BaseQ = {
	groups?: any // Not documented but appears in condition and samplelst?? same as groupsetting?
	groupsetting?: GroupSetting
	hiddenValues?: HiddenValues
	isAtomic?: boolean
	lst?: RangeEntry[]
	name?: string
	mode?: 'discrete' | 'binary' | 'continuous' | 'spline' | 'cuminc' | 'cox'
	reuseId?: string
	type?: 'values' | 'regular-bin' | 'custom-bin' | 'predefined-groupset' | 'custom-groupset' | 'custom-samplelst'
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
		group?: number //see handlers/categorical.ts
		uncomputable?: true //Not sure if this is correct??
	}
}

type ValueConversion = {
	scaleFactor: number
	fromUnit: string // name of unit for the original value
	toUnit: string // name of converted unit.
	// when converting day to year, resulting value will be `X year Y day`, that the fromUnit is used to indicate residue days from the last year; it's also printed in termsetting ui
	// this logic does not hold if converting from year to day, should detect if scaleFactor is >1 or <1
}

export type Term = {
	id?: string
	type?:
		| 'categorical'
		| 'integer'
		| 'float'
		| 'condition'
		| 'survival'
		| 'samplelst'
		| 'geneVariant'
		| 'snplocus'
		| 'snplst'
	child_types?: string[]
	groupsetting?: GroupSetting
	hashtmldetail?: boolean
	included_types?: string[]
	isleaf?: boolean
	logScale?: string | number //2, 10, or e only
	max?: number
	min?: number
	name?: string
	skip0forPercentile?: boolean
	subconditions?: Subconditions
	tvs?: Tvs
	values?: TermValues
	unit?: string
	valueConversion?: ValueConversion
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

// export function matchTermType(term: Term): Q | undefined {
// 	switch (term.type) {
// 	  case 'categorical':
// 		return {
// 		  termType: 'categorical',
// 		} as CategoricalConditionQ;
// 	  case 'integer':
// 		return {
// 		  termType: 'integer',
// 		} as NumericQ;
// 	  case 'float':
// 		return {
// 		  termType: 'float',
// 		} as NumericQ;
// 	  case 'condition':
// 		return {
// 		  termType: 'conditional',
// 		} as CategoricalConditionQ;
// 	  case 'survival':
// 		return {
// 		  termType: 'survival',
// 		} as BaseQ;
// 	  case 'samplelst':
// 		return {
// 		  termType: 'samplelst',
// 		} as BaseQ;
// 	  case 'geneVariant':
// 		return {
// 		  termType: 'geneVariant',
// 		} as GeneVariantQ;
// 	  case 'snplocus':
// 		return {
// 		  termType: 'snplocus',
// 		} as SnpLocusQ;
// 	  case 'snplst':
// 		return {
// 		  termType: 'snplst',
// 		} as SnpLstQ;
// 	  default:
// 		return undefined;
// 	}
//   }

export type TermWrapper = {
	//Term wrapper aka. term:{term:{...}, q:{...}...}
	id?: string
	$id?: string
	isAtomic?: boolean
	term: Term
	q: Q
}

export type TWDynamicQ = TermWrapper & { q: DetermineQ<TermWrapper['term']['type']> }
