import type { MinBaseQ, BaseTerm, TermGroupSetting, BaseTW, TermValues, BaseGroupSet, TermFilter } from '../index.ts'
import type { TermSettingInstance } from '../termsetting.ts'

// q types
export type GvBaseQ = MinBaseQ & {
	cnvGainCutoff?: number
	cnvMaxLength?: number
	cnvMinAbsValue?: number
	cnvLossCutoff?: number
}

type RawGvValuesQ = GvBaseQ & { type?: 'values' }
type RawGvCustomGsQ = GvBaseQ & { type: 'custom-groupset'; customset?: BaseGroupSet }

export type GvValuesQ = GvBaseQ & { type: 'values' }
export type GvCustomGsQ = GvBaseQ & { type: 'custom-groupset'; customset: BaseGroupSet }

export type GvQ = GvValuesQ | GvCustomGsQ

// term types
type GvBaseTerm = BaseTerm & {
	type: 'geneVariant'
}

export type GvGene = {
	kind: 'gene'
	gene: string
	// chr,start,stop should exist together as a separate type called
	// 'Coord', but hard to code as atomic `& Coord` because it may
	// need to be filled in
	chr?: string
	start?: number
	stop?: number
}

export type GvCoord = {
	kind: 'coord'
	chr: string
	start: number
	stop: number
}

export type RawGvTerm = GvBaseTerm &
	(GvGene | GvCoord) & {
		groupsetting?: TermGroupSetting
		filter?: TermFilter
	}

export type GvTerm = GvBaseTerm &
	(GvGene | GvCoord) & {
		groupsetting: TermGroupSetting
		filter: TermFilter
	}

// tw types
export type RawGvValuesTW = BaseTW & {
	type?: 'GvValuesTW'
	term: RawGvTerm
	q: RawGvValuesQ
}

export type RawGvCustomGsTW = BaseTW & {
	type?: 'GvCustomGsTW'
	term: RawGvTerm
	q: RawGvCustomGsQ
}

export type GvValuesTW = BaseTW & {
	type: 'GvValuesTW'
	term: GvTerm
	q: GvValuesQ
}

export type GvCustomGsTW = BaseTW & {
	type: 'GvCustomGsTW'
	term: GvTerm
	q: GvCustomGsQ
}

export type RawGvTW = RawGvValuesTW | RawGvCustomGsTW
export type GvTW = GvValuesTW | GvCustomGsTW

// termsetting types
export type GeneVariantTermSettingInstance = TermSettingInstance & {
	q: GvQ
	term: GvTerm
	category2samplecount: any
	groupSettingInstance?: any
}

// miscellaneous types
export type DtTerm = {
	id: string
	query: string
	name: string
	name_noOrigin: string
	geneVariantTerm: RawGvTerm
	parent_id: any
	isleaf: boolean
	type: string
	dt: number
	origin?: string
	values: TermValues
}
