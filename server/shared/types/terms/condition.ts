import { BaseQ } from './term'
import { TermWrapper } from './tw'

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
	bar_by_children?: boolean // 'true' if term is not a leaf and has subconditions
	bar_by_grade?: boolean /* 'true' for barchart. Always 'true' for cuminc and logistic/cox outcome (children terms are not allowed for those cases)
	when 'true', 'value_by_*' flags are effective.*/
	breaks?: number[] /*
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
	value_by_max_grade?: boolean //'false' if bar_by_children is 'true'
	value_by_most_recent?: boolean //'false' if bar_by_children is 'true'
	value_by_computable_grade?: boolean //'true' if bar_by_children is 'true'
	groups?: any // TODO: should use a defined type
}

/**
 * @group Termdb
 * @category TW
 */
export type ConditionTW = TermWrapper & {
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
