import { TermWrapper, BaseSnpQ, Term } from './termdb'
import { TermSettingInstance } from './termsetting'
import { VocabApi } from './vocab'

/*
--------EXPORTED--------
SnpLocusQ

*/

export type SnpLocusQ = BaseSnpQ & {
	termType: 'snplocus'
	info_fields?: any //[] Not documented
	chr: string
	start: number
	stop: number
	variant_filter: any
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
	gt2count?: {
		k: string
		v: string
	}
	chr?: string
	pos?: number
	alt2csq?: any //{} In document but not implemented?
}

type SnpLocusTerm = Term & {
	id: string
	snps?: SnpsEntry[]
}

export type SnpLocusTermWrapper = TermWrapper & {
	q: SnpLocusQ
	term: SnpLocusTerm
}

type VariantFilter = {
	active: any
	filter: any
	opts: any
	terms: any
}

export type SnpLocusVocabApi = VocabApi & {
	validateSnps: (f?: any) => {
		error?: any
		cacheid: string
		snps: any
		reachedVariantLimit: any
	}
	get_variantFilter: () => any
}

export type SnpLocusTermSettingInstance = TermSettingInstance & {
	q: Partial<SnpLocusQ>
	term: SnpLocusTerm
	variantFilter: VariantFilter
	vocabApi: SnpLocusVocabApi
}
