import type { BaseValue } from './terms/term.ts'
import type { NumericTerm, NumericBin } from './terms/numeric.ts'
import type { CategoricalTerm } from './terms/categorical.ts'
import type { DtTerm } from './terms/geneVariant.ts'
import type { ConditionTerm } from './terms/condition.ts'
import type { TermCollection } from './terms/termCollection.ts'

/*
--------EXPORTED--------
Tvs
LstEntry
Filter

*/

/*** types supporting Tvs type ***/

export type BaseTvs = {
	join?: string //and, or
	isnot?: boolean
	/** 'cohortFilter' or other tag to help extract a nested filter entry
	 * this was mostly designed for client-side use, should verify where in server-side
	 * this is used
	 * */
	tag?: string
	// Additional properties used in runtime
	// TODO: move this to condition terms only
	bar_by_grade?: boolean
	bar_by_children?: boolean
	value_by_max_grade?: boolean
	value_by_most_recent?: boolean
	value_by_computable_grade?: boolean
}

export type CategoricalTvs = BaseTvs & {
	term: CategoricalTerm
	groupset_label?: string
	values: BaseValue[]
	valueset?: Set<any> // Runtime property set by setDatasetAnnotations
}

export type NumericTvs = BaseTvs & {
	term: NumericTerm
	ranges: (NumericBin | { value: number; label?: string; name?: string })[]
	// TODO: define uncomputable values object
	values?: {
		key: string
		value: number
		uncomputable: true
		label?: string
	}[]
}

type GradeAndChildEntry = {
	grade: number
	grade_label: string
	child_id: string | undefined
	child_label: string
}

export type ConditionTvs = BaseTvs & {
	term: ConditionTerm
	value_by_max_grade?: boolean
	value_by_most_recent?: boolean
	value_by_computable_grade?: boolean
	grade_and_child?: GradeAndChildEntry[]
	values: { key: string | number; label?: string; [key: string]: any }[]
}

/** a genomic range constraining a breakpoint of a sv/fusion event.
 * .start and .stop are both inclusive. a breakpoint on a different chr, or one
 * lacking a position (e.g. events from a svfusion byname query), is out of range */
export type BreakpointRange = {
	chr: string
	start: number
	stop: number
}

/** the region a geneVariant query entry covers, carried by every value found through it.
 * A kind='gene' entry also has a .gene naming it; a kind='coord' entry has only this */
export type GvQueryRegion = {
	chr: string
	start: number
	stop: number
}

export type GeneVariantValue = {
	key?: string
	label?: string | number
	value?: string
	dt?: number
	mclasslst?: string[]
	mclassExcludeLst?: string[]
	origin?: string
	/** amino acid change (e.g. "G12D"); when set, entry matches only mutations
	 * of class=key that also carry this mname; when absent, entry matches any
	 * mutation of class=key */
	mname?: string
	/** gene of the amino acid change; when set, restricts an mname entry to this
	 * gene, so that e.g. KRAS G12D of a geneset term does not match NRAS G12D */
	gene?: string
	/** region the amino acid change was found in; the equivalent of .gene for a term
	 * over queried regions, which have no gene. Only one of the two is ever set,
	 * see matchesGvQueryEntry() in shared/utils/src/terms.ts */
	region?: GvQueryRegion
	/** for a sv/fusion entry, restricts the breakpoint on the partner gene (the
	 * gene named by .mname) to this range. the gene is implied by .mname and is
	 * not stored. must be satisfied by the same event that matches .mname, so
	 * that this range and the tvs .selfBreakpointRange cannot be satisfied by
	 * two different events of a sample */
	partnerBreakpointRange?: BreakpointRange
}

export type GeneVariantTvs = BaseTvs & {
	term: DtTerm
	values: GeneVariantValue[]
	/** boolean for including not tested classes (excluded by default) */
	includeNotTested?: boolean
	/** boolean for excluding gene name from pill name (included by default)
	 * used by geneVariant edit ui to exclude unnecessary gene name */
	excludeGeneName?: boolean
	/** FIXME following are quick fix to avoid tsc err. TODO define snvindel tsv type */
	genotype?: 'variant' | 'nt' | 'wt'
	mcount?: 'any' | 'single' | 'multiple' | 'all'
	/** for a sv/fusion tvs, restricts the breakpoint on the term's own gene to
	 * this range. only offered when the parent geneVariant term has a single
	 * gene, so the gene is implied and is not stored */
	selfBreakpointRange?: BreakpointRange
	/** FIXME following are quick fix to avoid tsc err. TODO define cnv tsv type */
	continuousCnv?: boolean
	cnvLossCutoff?: number
	cnvGainCutoff?: number
	cnvMaxLength?: number
	cnvWT?: boolean
	fractionOverlap?: number
}

export type TermCollectionTvs = BaseTvs & {
	term: TermCollection
	ratio: number
}

/*** types supporting Filter type ***/

export type Tvs = CategoricalTvs | NumericTvs | ConditionTvs | GeneVariantTvs | TermCollectionTvs // | SampleLstTvs ...

export type Filter = {
	type: 'tvslst'
	in: boolean
	join: string
	tag?: string // client-side only
	lst: ({ type: 'tvs'; tvs: Tvs } | Filter)[]
	$id?: string // Optional ID property
}
