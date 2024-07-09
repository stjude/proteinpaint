//import { TermWrapper, BaseQ } from '../termdb'
import {
	BaseTerm,
	BaseValue,
	TermValues,
	BaseQ,
	BaseTW,
	EmptyGroupSetting,
	PredefinedGroupSetting,
	CustomGroupSetting,
	ValuesGroup
} from './term.ts'

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
	groupsetting: EmptyGroupSetting
}

export type GroupSet = {
	mode: 'binary' | 'discrete'
	type?: 'predefined-groupset' | 'custom-groupset'
	name: string
	groups: ValuesGroup[]
	groupsetting: PredefinedGroupSetting | CustomGroupSetting | EmptyGroupSetting
}

export type CategoricalTerm = BaseTerm & {
	type: 'categorical'
	values: CategoricalValuesObject
	//groupsetting: { disabled?: boolean | undefined } //, lst?: GroupSet }
}

export type CategoricalQ = BaseQ & (CategoricalValuesObject | GroupSet)

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

type Cat2SampleCntEntry = { key: string; count: number }

export type GroupSetInputValues = {
	[index: string]: {
		label?: string | number //value's label on client
		group?: number //value's current group index
	}
}
