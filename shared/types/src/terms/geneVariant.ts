import type { MinBaseQ, BaseTerm, BaseTW, TermValues, BaseGroupSet, GroupEntry } from '../index.ts'

/* A predefined groupset of a geneVariant term.

Unlike the groupsets of other term types, these are built lazily: groups[] is only
filled in for the groupset that q.predefined_groupset_idx selects, because building one
requires querying the dataset for the mutation classes of its dt term(s). The rest are
listings of name and dt(s), which is all that is needed to pick one. See
listPredefinedGroupsets() and fillGroupsetGroups() in client/tw/geneVariant.ts.

So groups[] must be checked before it is read, or the groupset built first. */
export type GvGroupset = {
	name: string
	/** dt of a groupset over a single dt */
	dt?: number
	/** dts of a groupset that spans more than one, e.g. bi-/mono-allelic */
	dts?: number[]
	origin?: string
	/** absent until this groupset is the selected one */
	groups?: GroupEntry[]
}

export type GvGroupSetting = {
	disabled: boolean
	lst?: GvGroupset[]
}

// q types
export type GvBaseQ = MinBaseQ & {
	// TODO: may uncomment below if q.mode is required in downstream code
	// mode?: 'discrete' // may support 'continuous' for CNV?
	cnvGainCutoff?: number
	cnvMaxLength?: number
	cnvMinAbsValue?: number
	cnvLossCutoff?: number
}

/** a per-row filter over the variants of the term, so that two rows of the same
 * gene, e.g. KRAS G12D and KRAS G12V, can each show only their own variants. a
 * tvslst over the child dt terms, see shared/utils/src/geneVariantFilter.ts.
 * only meaningful for a 'values' q; a groupset filters through its groups */
type VariantFilterQ = { variantFilter?: any }

type RawGvValuesQ = GvBaseQ & VariantFilterQ & { type?: 'values' }
type RawGvPredefinedGsQ = GvBaseQ & {
	type: 'predefined-groupset'
	predefined_groupset_idx?: number
	dtLst?: any[] // dts to query
}
type RawGvCustomGsQ = GvBaseQ & {
	type: 'custom-groupset'
	customset?: BaseGroupSet
	dtLst?: any[] // dts to query
}
export type RawGvQ = RawGvValuesQ | RawGvPredefinedGsQ | RawGvCustomGsQ

export type GvValuesQ = GvBaseQ & VariantFilterQ & { type: 'values' }
export type GvPredefinedGsQ = GvBaseQ & {
	type: 'predefined-groupset'
	predefined_groupset_idx: number
	dtLst: any[] // dts to query
}
export type GvCustomGsQ = GvBaseQ & {
	type: 'custom-groupset'
	customset: BaseGroupSet
	dtLst: any[] // dts to query
}

export type GvQ = GvValuesQ | GvPredefinedGsQ | GvCustomGsQ

// term types
type Gene = {
	kind: 'gene'
	gene: string
	// chr,start,stop should exist together as a separate type called
	// 'Coord', but hard to code as atomic `& Coord` because it may
	// need to be filled in
	chr?: string
	start?: number
	stop?: number
}

type Coord = {
	kind: 'coord'
	chr: string
	start: number
	stop: number
}

type GvGeneTerm = BaseTerm & (Gene | Coord)

// including (Gene | Coord) for backwards compatibility
// with older geneVariant term structure
type GvBaseTerm = BaseTerm &
	(Gene | Coord) & {
		type: 'geneVariant'
		genes: GvGeneTerm[]
	}

export type RawGvTerm = GvBaseTerm & {
	groupsetting?: GvGroupSetting
	childTerms?: DtTerm[]
}

export type GvTerm = GvBaseTerm & {
	groupsetting: GvGroupSetting
	childTerms: DtTerm[]
}

// tw types
export type RawGvValuesTW = BaseTW & {
	type?: 'GvValuesTW'
	term: RawGvTerm
	q: RawGvValuesQ
}

export type RawGvPredefinedGsTW = BaseTW & {
	type?: 'GvPredefinedGsTW'
	term: RawGvTerm
	q: RawGvPredefinedGsQ
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

export type GvPredefinedGsTW = BaseTW & {
	type: 'GvPredefinedGsTW'
	term: GvTerm
	q: GvPredefinedGsQ
}

export type GvCustomGsTW = BaseTW & {
	type: 'GvCustomGsTW'
	term: GvTerm
	q: GvCustomGsQ
}

export type RawGvTW = RawGvValuesTW | RawGvPredefinedGsTW | RawGvCustomGsTW
export type GvTW = GvValuesTW | GvPredefinedGsTW | GvCustomGsTW

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
