import type { BaseValue } from './terms/term.ts'
import type { NumericTerm, NumericBin } from './terms/numeric.ts'
import type { CategoricalTerm } from './terms/categorical.ts'
import type { DtTerm } from './terms/geneVariant.ts'
import type { ConditionTerm } from './terms/condition.ts'

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
}

export type CategoricalTvs = BaseTvs & {
	term: CategoricalTerm
	groupset_label?: string
	values: BaseValue[]
}

export type NumericTvs = BaseTvs & {
	term: NumericTerm
	ranges: NumericBin[]
	// TODO: define uncomputable values object
	values: {
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
}

type GeneVariantTvs = BaseTvs & {
	term: DtTerm
	values: { key: string; label: string; value: string }[]
	/** boolean for including not tested classes (excluded by default) */
	includeNotTested?: boolean
}

/*** types supporting Filter type ***/

export type Tvs = CategoricalTvs | NumericTvs | ConditionTvs | GeneVariantTvs // | SampleLstTvs ...

export type Filter = {
	type: 'tvslst'
	in: boolean
	join: string
	tag?: string // client-side only
	lst: ({ type: 'tvs'; tvs: Tvs } | Filter)[]
}
