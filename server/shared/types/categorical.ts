import { TermWrapper, BaseQ } from './termdb'

export type CategoricalConditionQ = BaseQ & {
	termType: 'categorical' | 'conditional'
	bar_by_children?: boolean
	bar_by_grade?: boolean
	breaks?: number[]
	computableValuesOnly?: boolean
	showTimeScale?: boolean
	timeScale?: string
	value_by_max_grade?: boolean
	value_by_most_recent?: boolean
	value_by_computable_grade?: boolean
	//variant_filter???????? No documentation
}

export type CategoricalTW = TermWrapper & {
	q: CategoricalConditionQ
}
