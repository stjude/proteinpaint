import { TermSettingInstance } from '../termsetting'
import { TermWrapper, BaseQ } from '../termdb'

/*
--------EXPORTED--------
ConditionQ
ConditionalTW

*/

/**
 * @category TW
 */
export type ConditionQ = BaseQ & {
	// termType: 'conditional'
	bar_by_children?: boolean
	bar_by_grade?: boolean
	breaks?: number[]
	timeScale: 'age' | 'time'
	value_by_max_grade?: boolean
	value_by_most_recent?: boolean
	value_by_computable_grade?: boolean
}

/**
 * @group Termdb
 * @category TW
 */
export type ConditionTW = TermWrapper & {
	q: ConditionQ
}

/**
 * @group Termdb
 * @category TW
 */
export type ConditionTermSettingInstance = TermSettingInstance & {
	q: ConditionQ
	category2samplecount: { key: string; label: string; count: number }[]
	refGrp: any
}
