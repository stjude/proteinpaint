//import { TermWrapper, BaseQ } from '../termdb'
import { Term, BaseValue, BaseQ } from './term'
import { TermSettingInstance } from '../termsetting'

/*
--------EXPORTED--------
CategoricalQ
CategoricalTW
CategoricaTermSettingInstance

*/

/**
 * A categorical term q object
 *
 * test:CategoricalQ:
 *
 * @category TW
 */

export type CategoricalValuesObject = {
	[key: string]: BaseValue
}

export type ValuesGroup = {
	name: string
	values: {
		key: string
		label: string
	}[]
}

export type GroupSet = {
	name: string
	groups: ValuesGroup[]
}

export type CategoricalTerm = Term & {
	type: 'categorical'
	values: CategoricalValuesObject
	groupsetting: {
		disabled: boolean
		lst: GroupSet[]
	}
}

export type CategoricalQ = BaseQ & (CategoricalValuesObject | GroupSet)

/**
 * A categorical term wrapper object
 *
 * @group Termdb
 * @category TW
 */
export type CategoricalTW = {
	term: CategoricalTerm
	q: CategoricalQ
}

type Cat2SampleCntEntry = { key: string; count: number }

export type GroupSetInputValues = {
	[index: string]: {
		label?: string | number //value's label on client
		group?: number //value's current group index
	}
}

/**
 * @group Termdb
 * @category TW
 */
export type CategoricalTermSettingInstance = TermSettingInstance & {
	category2samplecount: Cat2SampleCntEntry[]
	error: string
	q: CategoricalQ
	//Methods
	getQlst: () => void
	grpSet2valGrp: (f: any) => GroupSetInputValues
	showGrpOpts: (div: any) => any
	validateGroupsetting: () => void
	showDraggables: () => void
}
