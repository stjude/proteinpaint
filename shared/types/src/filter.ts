import { BaseValue } from './terms/term.ts'
import { NumericTerm, NumericBin } from './terms/numeric.ts'
import { CategoricalTerm } from './terms/categorical.ts'
import { GeneVariantTerm } from './terms/geneVariant.ts'
import { ConditionTerm } from './terms/condition.ts'

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

type GeneVariantOrigin = 'somatic' | 'germline'

type SNVIndelClasses =
	| 'M'
	| 'E'
	| 'F'
	| 'N'
	| 'S'
	| 'D'
	| 'I'
	| 'P'
	| 'L'
	| 'Intron'
	| 'Blank'
	| 'WT'
	| 'ITD'
	| 'DEL'
	| 'NLOSS'
	| 'CLOSS'
	| 'Utr3'
	| 'Utr5'
	| 'X'
	| 'noncoding'
type SNVIndelTvsValue = {
	dt: 1
	mclassLst: SNVIndelClasses[]
	mclassExcludeLst: SNVIndelClasses[]
	origin?: GeneVariantOrigin
}

type CNVClasses = 'CNV_amp' | 'CNV_losss' | 'CNV_loh' | 'Blank' | 'WT'
type CNVTvsValue = {
	dt: 4
	mclassLst: CNVClasses[]
	mclassExcludeLst: CNVClasses[]
	origin?: GeneVariantOrigin
}

type SVClasses = 'SV' | 'Blank' | 'WT'
type SVTvsValue = {
	dt: 5
	mclassLst: SVClasses[]
	mclassExcludeLst: SVClasses[]
	origin?: GeneVariantOrigin
}

type FusionRNAClasses = 'Fuserna' | 'Blank' | 'WT'
type FusionTvsValue = {
	dt: 2
	mclassLst: FusionRNAClasses[]
	mclassExcludeLst: FusionRNAClasses[]
	origin?: GeneVariantOrigin
}

type GeneVariantTvsValue = SNVIndelTvsValue | CNVTvsValue | SVTvsValue | FusionTvsValue

type GeneVariantTvs = BaseTvs & {
	term: GeneVariantTerm
	values: GeneVariantTvsValue[]
}
/*** types supporting Filter type ***/

export type Tvs = CategoricalTvs | NumericTvs | ConditionTvs | GeneVariantTvs // | SampleLstTvs ...

export type Filter = {
	type: 'lst'
	in?: boolean
	join: 'and' | 'or'
	tag?: string // client-side only
	lst: (Filter | Tvs)[]
}
