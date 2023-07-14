import { TermWrapper, BaseQ } from '../termdb'

/*
--------EXPORTED--------
ConditionQ
ConditionalTW

*/

export type ConditionQ = BaseQ & {
	// termType: 'conditional'
	bar_by_children?: boolean
	bar_by_grade?: boolean
	breaks: number[]
	timeScale: 'age' | 'time'
	value_by_max_grade?: boolean
	value_by_most_recent?: boolean
	value_by_computable_grade?: boolean
}

export type ConditionalTW = TermWrapper & {
	q: ConditionQ
}
