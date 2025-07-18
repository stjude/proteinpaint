import type {
	MinBaseQ,
	BaseTerm,
	PredefinedTermGroupSetting,
	OtherTermGroupSetting,
	BaseTW,
	TermValues,
	BaseGroupSet,
	FilterGroup
} from '../index.ts'
import type { TermSettingInstance } from '../termsetting.ts'

// q types
export type GvBaseQ = MinBaseQ & {
	cnvGainCutoff?: number
	cnvMaxLength?: number
	cnvMinAbsValue?: number
	cnvLossCutoff?: number
}

type RawGvValuesQ = GvBaseQ & { type?: 'values' }
type RawGvPredefinedGsQ = GvBaseQ & { type: 'predefined-groupset'; predefined_groupset_idx?: number }
type RawGvCustomGsQ = GvBaseQ & { type: 'custom-groupset'; customset?: BaseGroupSet }

export type GvValuesQ = GvBaseQ & { type: 'values' }
export type GvPredefinedGsQ = GvBaseQ & { type: 'predefined-groupset'; predefined_groupset_idx: number }
export type GvCustomGsQ = GvBaseQ & { type: 'custom-groupset'; customset: BaseGroupSet }

export type GvQ = GvValuesQ | GvPredefinedGsQ | GvCustomGsQ

// term types
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

type GvBaseTerm = BaseTerm & { type: 'geneVariant' } & (GvGene | GvCoord)

export type RawGvPredefinedGsTerm = GvBaseTerm & {
	groupsetting?: PredefinedTermGroupSetting
	childTerms?: DtTerm[]
}

export type RawGvOtherTerm = GvBaseTerm & {
	groupsetting?: OtherTermGroupSetting
	childTerms?: DtTerm[]
}

export type RawGvTerm = RawGvPredefinedGsTerm | RawGvOtherTerm

export type GvPredefinedGsTerm = GvBaseTerm & {
	groupsetting: PredefinedTermGroupSetting
	childTerms: DtTerm[]
}

export type GvOtherTerm = GvBaseTerm & {
	groupsetting: OtherTermGroupSetting
	childTerms: DtTerm[]
}

export type GvTerm = GvPredefinedGsTerm | GvOtherTerm

// tw types
export type RawGvValuesTW = BaseTW & {
	type?: 'GvValuesTW'
	term: RawGvOtherTerm
	q: RawGvValuesQ
}

export type RawGvPredefinedGsTW = BaseTW & {
	type?: 'GvPredefinedGsTW'
	term: RawGvPredefinedGsTerm
	q: RawGvPredefinedGsQ
}

export type RawGvCustomGsTW = BaseTW & {
	type?: 'GvCustomGsTW'
	term: RawGvOtherTerm
	q: RawGvCustomGsQ
}

export type GvValuesTW = BaseTW & {
	type: 'GvValuesTW'
	term: GvOtherTerm
	q: GvValuesQ
}

export type GvPredefinedGsTW = BaseTW & {
	type: 'GvPredefinedGsTW'
	term: GvPredefinedGsTerm
	q: GvPredefinedGsQ
}

export type GvCustomGsTW = BaseTW & {
	type: 'GvCustomGsTW'
	term: GvOtherTerm
	q: GvCustomGsQ
}

export type RawGvTW = RawGvValuesTW | RawGvPredefinedGsTW | RawGvCustomGsTW
export type GvTW = GvValuesTW | GvPredefinedGsTW | GvCustomGsTW

// termsetting types
export type GeneVariantTermSettingInstance = TermSettingInstance & {
	q: GvQ
	term: GvTerm
	category2samplecount: any
	groups: FilterGroup[] // will store groups created in edit UI
}

// miscellaneous types
export type DtTerm = {
	id: string
	query: string
	name: string
	name_noOrigin: string
	parentTerm?: RawGvTerm
	parent_id: any
	isleaf: boolean
	type: string
	dt: number
	origin?: string
	values: TermValues
}
