//import { TermWrapper, BaseQ } from '../termdb'
import { BaseTerm, BaseValue, BaseQ, BaseTW, QGroupSetting, TermGroupSetting, ValuesGroup } from './term.ts'

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
	mode: 'binary' | 'discrete'
	type?: 'values'
	values: {
		[key: string]: BaseValue
	}
}

export type GroupSet = {
	mode: 'binary' | 'discrete'
	type?: 'predefined-groupset' | 'custom-groupset'
	name: string
	groups: ValuesGroup[]
}

export type CategoricalTerm = BaseTerm & {
	type: 'categorical'
	values: CategoricalValuesObject
	groupsetting: TermGroupSetting & { useIndex: number }
}

export type CategoricalQ = BaseQ & QGroupSetting & (CategoricalValuesObject | GroupSet)

/**
 * A categorical term wrapper object
 *
 * @group Termdb
 * @category TW
 */
export type CategoricalTW = BaseTW & {
	id: string
	term: CategoricalTerm
	q: CategoricalQ
}

//type Cat2SampleCntEntry = { key: string; count: number }

export type GroupSetInputValues = {
	[index: string]: {
		label?: string | number //value's label on client
		group?: number //value's current group index
	}
}
