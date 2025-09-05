import type { BaseTerm, MinBaseQ, TermValues, BaseTW } from '../index.ts'
//import type { TermWrapper } from './tw.ts'

/**
 * @category TW
 */

export type ConditionGradeQ = MinBaseQ & {
	mode: 'discrete' | 'binary' | 'cuminc' | 'cox'
	bar_by_grade: true
	/**
		Breaks grades into groups
		Array length=1, will break grades to 2 groups. 
			E.g. [3] divides to [-1,0,1,2,], [3,4,5]
			Allowed for both conditionModes "discrete/binary"
		Array length=2, break to 3 groups. 
			E.g. [1,2] divides to [-1,0], [1], [2,3,4,5]
			E.g. [1,3] divides to [-1,0], [1,2], [3,4,5]
			Only allowed for conditionMode="discrete" but not "binary"
	*/
	timeScale: 'age' | 'time'
	breaks?: number[]
	value_by_max_grade?: boolean //'false' if bar_by_children is 'true'
	value_by_most_recent?: boolean //'false' if bar_by_children is 'true'
	value_by_computable_grade?: boolean //'true' if bar_by_children is 'true'
	groups?: any // TODO: should use a defined type
}

export type ConditionChildrenQ = MinBaseQ & {
	mode: 'discrete'
	bar_by_children: true
	groups?: any // TODO: should use a defined type
}

// TODO: should implement the expected property combinations as distinct types
export type ConditionQ = ConditionGradeQ | ConditionChildrenQ

export type ConditionTerm = BaseTerm & {
	type: 'condition'
	values: TermValues
}

/**
 * @group Termdb
 * @category TW
 */
export type ConditionTW = BaseTW & {
	type: 'ConditionTW'
	term: ConditionTerm
	q: ConditionQ //replace the generic Q with specific condition Q
}

/**
 * @group Termdb
 * @category TW
 */
/*
export type ConditionTermSettingInstance = TermSettingInstance & {
	q: ConditionQ
	category2samplecount: { key: string; label: string; count: number }[]
	refGrp: any
}
*/
