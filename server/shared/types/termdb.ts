import { Tvs, Filter } from './filter'

/*
--------EXPORTED--------
RangeEntry
GroupEntry
GroupSetEntry
GroupSetting
Q
TermValues
Term
TW

*/

type KV = {
	k: string
	v: string
}

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

interface BaseQ {
	groupsetting?: GroupSetting
	mode?: 'discrete' | 'binary' | 'continuous' | 'spline' | 'cuminc' | 'cox'
	modeBinaryCutoffType?: 'normal' | 'percentile'
	modeBinaryCutoffPercentile?: number
	type?: 'values' | 'regular-bin' | 'custom-bin' | 'predefined-groupset' | 'custom-groupset'
	reuseId?: string
}

export interface BinConfig extends BaseQ {
	termtype?: string
	//regular-sized bins
	bin_size?: number
	startinclusive?: boolean
	stopinclusive?: boolean
	first_bin?: {
		startunbounded: boolean
		stop: number
	}
	last_bin?: {
		start: number
		stopunbounded: boolean
	}
	//binary
	scale?: number //0.1 | 0.01 | 0.001
	lst?: RangeEntry[]
}

export type GroupEntry = {
	name: string
	type?: 'values' | 'filter'
	color?: string
	values: { key: number | string; label: string }[]
	filter?: Filter
}

export interface BaseGroupSet {
	groups: GroupEntry[]
}

export interface GroupSetEntry extends BaseGroupSet {
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

type RestrictAncestry = {
	name: string
	tvs: Tvs
}

export interface Q extends BaseQ {
	isAtomic?: boolean
	hiddenValues?: HiddenValues
	knots?: []
	name?: string
	//Condition terms
	bar_by_children?: boolean
	bar_by_grade?: boolean
	breaks?: number[]
	computableValuesOnly?: boolean
	groupNames?: string[]
	timeScale?: string
	showTimeScale?: boolean
	value_by_max_grade?: boolean
	value_by_most_recent?: boolean
	value_by_computable_grade?: boolean
	//geneVariant
	cnvGainCutoff?: number
	cnvMaxLength?: number
	cnvMinAbsValue?: number
	cnvLossCutoff?: number
	//snplst
	AFcutoff?: number
	alleleType?: number
	cacheid?: string
	geneticModel?: number
	missingGenotype?: number
	numOfSampleWithAnyValidGT?: number
	restrictAncestry?: RestrictAncestry
	snp2effAle?: KV
	snp2refGrp?: KV
	//snplocus
	info_fields?: any //[] Not documented
	chr?: string
	start?: number
	stop?: number
	//variant_filter???????? No documentation
}

/*** interfaces supporting Term interface ***/

export type TermValues = {
	[index: string | number]: {
		uncomputable?: boolean
		label?: string
		order?: string
		color?: string
		//'samplelst' values
		key?: string
		inuse?: boolean
		list?: { sampleId: string; sample: string }[]
		filter?: Filter
	}
}

type NumericalBins = {
	label_offset?: number
	label_offset_ignored?: boolean
	rounding?: string
	default: BinConfig
	less: BinConfig
}

type Gt2Count = {
	k: string
	v: number
}

type AllelesEntry = {
	allele: string
	isRef: boolean
	count: number
}

type SnpsEntry = {
	snpid: string
	invalid?: boolean
	effectAllele?: string
	referenceAllele?: string
	altAlleles?: string[]
	alleles?: AllelesEntry[]
	gt2count?: Gt2Count
	chr?: string
	pos?: number
	alt2csq?: any //{} In document but not implemented?
}

type Subconditions = {
	[index: string]: { label: string }
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
		| 'snplist'
	bins?: NumericalBins
	child_types?: string[]
	densityNotAvailable?: boolean //Not used?
	groupsetting?: GroupSetting
	hashtmldetail?: boolean
	included_types?: string[]
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
	//snplist
	snps?: SnpsEntry[]
	//geneVariant
	isoform?: string
}

export type TW = {
	//Term wrapper aka. term:{term:{...}, q:{...}...}
	id?: string
	$id?: string
	isAtomic?: boolean
	term: Term
	term2?: Term
	term0?: Term
	q: Q
}
