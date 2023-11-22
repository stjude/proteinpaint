import { Term, BaseValue } from './terms/term'
import { NumericTerm, NumericBin } from './terms/numeric'
import { CategoricalTerm } from './terms/categorical'

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

/*type GradeAndChildEntry = {
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

type GeneVariantOrigin = 'somatic' | 'germline'

type SNVIndelClasses = 'F' | 'M' | 'S' // ... 
type SNVIndelTvsValue = {
	dt: 1
	mclassLst: SNVIndelClasses[]
	mclassExcludeLst: SNVIndelClasses[]
	origin?: GeneVariantOrigin
}

type CNVClasses = 'CNV_amp' | 'CNV_losss'
type CNVTvsValue = {
	dt: 4
	mclassLst: CNVClasses[]
	mclassExcludeLst: CNVClasses[]
	origin?: GeneVariantOrigin
}

type SVTvsValue = {
	dt: 5
	// ... 
}

type FusionTvsValue = {
	dt: 2
	// ...
}

type GeneVariantTvsValue = SNVIndelTvsValue | CNVTvsValue | SVTvsValue | FusionTvsValue

type GeneVariantTvs = {
	term: GeneVariantTerm
	values: GeneVariantTvsValue[]
}
*/
/*** types supporting Filter type ***/

export type Tvs = CategoricalTvs | NumericTvs // | ConditionTvs | GeneVariantTvs // | SampleListTvs ...

export type Filter = {
	type: 'lst'
	in?: boolean
	join: 'and' | 'or'
	tag?: string // client-side only
	lst: (Filter | Tvs)[]
}
