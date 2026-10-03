import type { MinBaseQ, BaseTerm, BaseTW, TermValues, BaseGroupSet, GroupEntry } from '../index.ts'

/* ================================================================================
LEGACY TYPES

Collected here, apart from the types that reflect the CURRENT geneVariant termwrapper
shape below, so that "what a saved/url-embedded tw may carry for backward compatibility"
stays easy to tell apart from "what fill() currently builds". None of these should be
used when authoring new code; they exist only so that GvBase.fill() in
client/tw/geneVariant.ts (see its "Support legacy term structure" comments) can migrate
an older tw to the current shape, or a server route can still read an older standalone
tvs (see getTermOrigins() in server/src/mds3.init.js).

Each is spliced into the current type it extends below via `&`, with a comment there
pointing back here.
================================================================================ */

/** before term.genes[] existed, a geneVariant term over a single gene/region carried the
 * gene/coord fields directly on the term itself, rather than nested under genes[]. Spliced
 * into GvBaseTerm below. GvBase.fill() copies these onto genes[0] the first time it sees a
 * term without genes[], but does not strip them off the term, so even a filled term may
 * still carry them */
type LegacyGvSingleGeneTerm = Partial<Gene> & Partial<Coord>

/** before a dt split by origin (e.g. somatic/germline snvindel) became a parent-term
 * origins[] selection, each origin got its own child dt term, flagged and named this way
 * (e.g. id 'snvindel_somatic', name 'SNV/indel (somatic)'). Spliced into DtTerm below.
 * GvBase.fill() migrates a saved selection of one of these into term.origins[] (see the
 * "Support legacy term structure" block there), and server/src/mds3.init.js's
 * getTermOrigins() still reads tvs.term.origin directly for a standalone tvs filter that
 * was never attached to a tw, e.g. a hand-written mass filter url */
type LegacyDtTermFields = {
	/** the origin of this specific child term, e.g. 'somatic' */
	origin?: string
	/** the dt term's name without its origin suffix, e.g. 'SNV/indel' rather than
	 * 'SNV/indel (somatic)' */
	name_noOrigin?: string
}

/* ================================================================================
CURRENT TYPES
================================================================================ */

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
/** a raw q may also carry a stray top-level .dt/.origin from an even older, pre-childTerms
 * groupset selection, predating q.predefined_groupset_idx/q.dtLst entirely. Not modeled as a
 * field here because nothing reads it anymore: GvPredefinedGS.fill() in
 * client/tw/geneVariant.ts resolves the groupset from predefined_groupset_idx/dtLst alone, so
 * the extra keys are simply ignored rather than migrated */
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

type GvBaseTerm = BaseTerm &
	// see LegacyGvSingleGeneTerm above: kept only for a term saved/url-embedded before
	// term.genes[] existed
	LegacyGvSingleGeneTerm & {
		type: 'geneVariant'
		genes: GvGeneTerm[]
		/** origins selected for an origin-split data type */
		origins?: string[]
		/** display label for the selected origin subset */
		originLabel?: string
		/** combined sample-type and origin display label */
		label?: string
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
export type DtTerm = LegacyDtTermFields & {
	id: string
	query: string
	name: string
	parentTerm?: RawGvTerm
	parent_id: any
	isleaf: boolean
	type: string
	dt: number
	values: TermValues
}
