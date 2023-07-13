import { TermWrapper, BaseQ, Term } from './termdb'
import { TermSettingInstance, InstanceDom, UseCase } from './termsetting'
import { VocabApi } from './vocab'
import { Tvs, Filter } from './filter'

/*
--------EXPORTED--------
SnpLocusQ
SnpLocusTermWrapper
SnpLocusVocabApi
SnpLocusTermSettingInstance

*/

type RestrictAncestry = {
	name: string
	tvs: Tvs
}

export type SnpsQ = BaseQ & {
	// termType: 'snplocus' | 'snplst'
	//for snplst and snplocus term types
	AFcutoff: number
	alleleType: number
	cacheid: string
	doNotRestrictAncestry: any
	geneticModel: number
	info_fields?: any //[] Not documented
	missingGenotype?: number
	numOfSampleWithAnyValidGT: number
	restrictAncestry: RestrictAncestry
	snp2effAle?: any
	snp2refGrp: any //[] maybe??
	variant_filter: Filter
	//Position
	chr: string
	start: number
	stop: number
}

type AllelesEntry = {
	allele: string
	count: number
	isRef: boolean
}

export type SnpsEntry = {
	alt2csq?: any //{} In document but not implemented?
	altAlleles?: string[]
	alleles?: AllelesEntry[]
	effectAllele: boolean
	gt2count?: {
		k: string
		v: string | number
	}
	invalid?: boolean
	referenceAllele?: string
	rsid: string
	snpid: string
	tobe_deleted?: any
	//Position properties
	chr?: string
	pos?: number
}

export type SnpsTerm = Term & {
	id: string
	reachedVariantLimit?: boolean
	snps?: SnpsEntry[]
}

export type SnpsTermWrapper = TermWrapper & {
	q: SnpsQ
	term: SnpsTerm
}

type VariantFilter = {
	active: any
	filter: any
	opts: any
	terms: any
}

export type SnpsVocabApi = VocabApi & {
	validateSnps: (f?: any) => {
		error?: any
		cacheid: string
		snps: any
		reachedVariantLimit: any
	}
	get_variantFilter: () => any
}

type SnpsDom = InstanceDom & {
	input_AFcutoff_label: any
	restrictAncestriesRow: any
	setEffectAlleleAsHint: any
	snplst_table: any
}

export type SnpsTermSettingInstance = TermSettingInstance & {
	dom: SnpsDom
	q: Partial<SnpsQ>
	term: SnpsTerm
	usecase: UseCase
	variantFilter: VariantFilter
	vocabApi: SnpsVocabApi
}
