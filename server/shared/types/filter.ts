import { Term, RangeEntry } from './termdb'

/*
--------EXPORTED--------
Tvs
LstEntry
Filter

*/

/*** types and interfaces supporting Tvs interface ***/

type TvsValues = {
	key?: string
	label?: string
	//geneVariant
	dt?: number
	mclassLst?: string[]
	mclassExcludeLst?: string[]
	origin?: string
}

type GradeAndChildEntry = {
	grade: number
	grade_label: string
	child_id: string | undefined
	child_label: string
}

export type Tvs = {
	term: Term
	values: TvsValues[]
	join?: string //and, or
	isnot?: boolean
	groupset_label?: string
	ranges?: RangeEntry[]
	value_by_max_grade?: boolean
	value_by_most_recent?: boolean
	value_by_computable_grade?: boolean
	grade_and_child?: GradeAndChildEntry[]
}

/*** types and interfaces supporting Filter interface ***/

export type LstEntry = {
	type: string
	tvs: Tvs
}

export type Filter = {
	type: string
	in?: boolean
	join?: string //and, or
	tag?: string
	lst: LstEntry[]
}
