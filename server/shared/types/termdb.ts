import { Tvs, Filter } from './filter'
import { CategoricalConditionQ } from './categorical'
import { NumericQ } from './numeric'
import { GeneVariantQ } from './geneVariant'
import { SnpLocusQ } from './snplocus'
import { SnpLstQ } from './snplst'

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

// type KV = {
// 	k: string
// 	v: string
// }

/*** interfaces supporting Q interface ***/

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
	inuse?: boolean
	disabled?: boolean
	useIndex?: number
	predefined_groupset_idx?: number
	lst?: GroupSetEntry[]
	customset?: BaseGroupSet
}

// type RestrictAncestry = {
// 	name: string
// 	tvs: Tvs
// }

export type BaseQ = {
	groups?: any // Not documented but appears in condition and samplelst?? same as groupsetting?
	groupsetting?: GroupSetting
	hiddenValues?: HiddenValues
	isAtomic?: boolean
	lst?: RangeEntry[]
	name?: string
	mode?: 'discrete' | 'binary' | 'continuous' | 'spline' | 'cuminc' | 'cox'
	reuseId?: string
	type?: 'values' | 'regular-bin' | 'custom-bin' | 'predefined-groupset' | 'custom-groupset' | 'custom-groupsetting'
}

// export type NumericQ = BaseQ & {
// 	termType: 'numeric' | 'float' | 'integer'
// 	preferredBins?: string
// 	termtype?: string
// 	//regular-sized bins
// 	bin_size?: number
// 	startinclusive?: boolean
// 	stopinclusive?: boolean
// 	first_bin?: {
// 		startunbounded: boolean
// 		stop: number
// 	}
// 	last_bin?: {
// 		start: number
// 		stopunbounded: boolean
// 	}
// 	modeBinaryCutoffType?: 'normal' | 'percentile'
// 	modeBinaryCutoffPercentile?: number
// 	//binary
// 	scale?: number //0.1 | 0.01 | 0.001
// }

// export type CategoricalConditionQ = BaseQ & {
// 	termType: 'categorical' | 'conditional'
// 	bar_by_children?: boolean
// 	bar_by_grade?: boolean
// 	breaks?: number[]
// 	computableValuesOnly?: boolean
// 	showTimeScale?: boolean
// 	timeScale?: string
// 	value_by_max_grade?: boolean
// 	value_by_most_recent?: boolean
// 	value_by_computable_grade?: boolean
// 	//variant_filter???????? No documentation
// }

type RegressionQ = BaseQ & {
	termType: 'regression'
	knots?: []
}

type RestrictAncestry = {
	name: string
	tvs: Tvs
}

export type BaseSnpQ = BaseQ & {
	//for snplst and snplocus term types
	AFcutoff: number
	alleleType: number
	geneticModel: number
	restrictAncestry: RestrictAncestry
	cacheid: string
}

// type GeneVariantQ = BaseQ & {
// 	termType: 'geneVariant'
// 	cnvGainCutoff?: number
// 	cnvMaxLength?: number
// 	cnvMinAbsValue?: number
// 	cnvLossCutoff?: number
// }

// type SnpLstQ = BaseQ & {
// 	termType: 'snplst'
// 	AFcutoff?: number
// 	alleleType?: number
// 	cacheid?: string
// 	geneticModel?: number
// 	missingGenotype?: number
// 	numOfSampleWithAnyValidGT?: number
// 	restrictAncestry?: RestrictAncestry
// 	snp2effAle?: KV
// 	snp2refGrp?: KV
// }

// type SnpLocusQ = BaseQ & {
// 	termType: 'snplocus'
// 	info_fields?: any //[] Not documented
// 	chr?: string
// 	start?: number
// 	stop?: number
// }

export type Q = BaseQ | CategoricalConditionQ | NumericQ | RegressionQ | GeneVariantQ | SnpLstQ | SnpLocusQ

/*** interfaces supporting Term interface ***/

export type TermValues = {
	[index: string | number]: {
		uncomputable?: boolean
		label?: string | number
		order?: string
		color?: string
		//'samplelst' values
		key?: string
		inuse?: boolean
		list?: { sampleId: string; sample: string }[]
		filter?: Filter
		group?: number
	}
}

// type NumericalBins = {
// 	label_offset?: number
// 	label_offset_ignored?: boolean
// 	rounding?: string
// 	default: NumericQ
// 	less: NumericQ
// }

// type AllelesEntry = {
// 	allele: string
// 	isRef: boolean
// 	count: number
// }

// type SnpsEntry = {
// 	snpid: string
// 	invalid?: boolean
// 	effectAllele?: string
// 	referenceAllele?: string
// 	altAlleles?: string[]
// 	alleles?: AllelesEntry[]
// 	gt2count?: KV
// 	chr?: string
// 	pos?: number
// 	alt2csq?: any //{} In document but not implemented?
// }

export type Subconditions = {
	[index: string | number]: {
		label: string
		group?: number //see handlers/categorical.ts
		uncomputable?: true //Not sure if this is correct??
	}
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
	//snplocus
	reachedVariantLimit?: boolean
}

export type DetermineQ<T extends Term['type']> = T extends 'numeric' | 'integer' | 'float'
	? NumericQ
	: T extends 'categorical' | 'condition'
	? CategoricalConditionQ
	: T extends 'regression'
	? RegressionQ
	: T extends 'geneVariant'
	? GeneVariantQ
	: T extends 'snplst'
	? SnpLstQ
	: T extends 'snplocus'
	? SnpLocusQ
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
