import { BaseTerm, BaseValue, MinBaseQ, BaseTW, TermGroupSetting, ValuesGroup, GroupEntry } from './term.js'

/*
--------EXPORTED--------
CategoricalValuesObject
CategoricalTerm
CategoricalQ
CategoricalTW
CategoricaTermSettingInstance
GroupSetInputValues
*/

/**
 * A categorical term q object
 *
 * test:CategoricalQ:
 *
 * @category TW
 */

// TODO: import and reuse this type from types/term/term.ts, once unnested as q.groupsetting
export type CatPredefinedGroupSettingNested = {
	//kind: 'predefined-groupset'
	predefined_groupset_idx: number
	inuse?: boolean // temporary duplicate with inuse one level above, will be unnested soon
}

// TODO: import and reuse this type from types/term/term.ts, once unnested as q.groupsetting
export type CatPredefinedGroupSettingQ = MinBaseQ & {
	type: 'predefined-groupset'
	mode?: 'binary'
	inuse?: boolean
	groupsetting: CatPredefinedGroupSettingNested
}

// TODO: import and reuse this type from types/term/term.ts, once unnested as q.groupsetting
export type CatCustomGroupSet = {
	groups: GroupEntry[]
}

// TODO: import and reuse this type from types/term/term.ts, once unnested as q.groupsetting
export type CatCustomGroupSettingNested = {
	//kind: 'custom-groupset'
	customset: CatCustomGroupSet
	inuse?: boolean // temporary duplicate with inuse one level above, will be unnested soon
}

// TODO: import and reuse this type from types/term/term.ts, once unnested as q.groupsetting
export type CatCustomGroupSettingQ = MinBaseQ & {
	type: 'custom-groupset'
	mode?: 'binary'
	inuse?: boolean
	groupsetting: CatCustomGroupSettingNested
}

// TODO: import and reuse this type from types/term/term.ts, once unnested as q.groupsetting
export type CategoricalValuesObject = MinBaseQ & {
	mode: 'binary' | 'discrete'
	type?: 'values'
	values: {
		[key: string]: BaseValue
	}
}

export type CategoricalQ = CatPredefinedGroupSettingQ | CatCustomGroupSettingQ | CategoricalValuesObject

export type GroupSet = CategoricalQ & {
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

export type GroupSetInputValues = {
	[index: string]: {
		/** value's label on client */
		label?: string | number
		/** value's current group index */
		group?: number
	}
}
