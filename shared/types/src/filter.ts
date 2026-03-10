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
	// Additional properties used in runtime
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

export type GeneVariantValue = {
	key?: string
	label?: string | number
	value?: string
	dt?: number
	mclasslst?: string[]
	mclassExcludeLst?: string[]
	origin?: string
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
