import type {
	BaseTerm,
	TermValues,
	GroupSettingQ,
	ValuesQ,
	TermGroupSetting,
	BaseTW,
	PredefinedGroupSettingQ,
	CustomGroupSettingQ
} from '../index.ts'
import type { RawValuesQ, RawPredefinedGroupsetQ, RawCustomGroupsetQ, MinBaseQ } from './q.ts'
import type { TermSettingInstance } from '../termsetting.ts'

/**
 * A raw categorical term q object, before filling-in
 *
 * test:CategoricalQ:
 *
 * @category TW
 */

export type RawCatTWValues = BaseTW & {
	type?: 'CatTWValues'
	/** must already exist, for dictionary terms, TwRouter.fill() will use mayHydrateDictTwLst() */
	term: CategoricalTerm
	q: RawValuesQ
}

export type RawCatTWPredefinedGS = BaseTW & {
	type?: 'CatTWPredefinedGS'
	term: CategoricalTerm
	q: RawPredefinedGroupsetQ
}

export type RawCatTWCustomGS = BaseTW & {
	type?: 'CatTWCustomGS'
	term: CategoricalTerm
	q: RawCustomGroupsetQ
}

export type RawCatTW = RawCatTWValues | RawCatTWPredefinedGS | RawCatTWCustomGS

export type CategoricalBaseQ = MinBaseQ & {
	mode?: 'discrete' | 'binary'
}

export type CategoricalQ = GroupSettingQ | ValuesQ

export type CategoricalTerm = BaseTerm & {
	type: 'categorical'
	values: TermValues
	groupsetting: TermGroupSetting
}

/**
 * A categorical term wrapper object
 *
 * @group Termdb
 * @category TW
 */

export type CategoricalTW = BaseTW & {
	//id: string
	type: 'CatTWValues' | 'CatTWPredefinedGS' | 'CatTWCustomGS'
	q: CategoricalQ
	term: CategoricalTerm
}

export type CatTWValues = BaseTW & {
	//id: string
	term: CategoricalTerm
	q: ValuesQ
	type: 'CatTWValues'
}

export type CatTWPredefinedGS = BaseTW & {
	//id: string
	term: CategoricalTerm
	q: PredefinedGroupSettingQ
	type: 'CatTWPredefinedGS'
}

export type CatTWCustomGS = BaseTW & {
	//id: string
	term: CategoricalTerm
	q: CustomGroupSettingQ
	type: 'CatTWCustomGS'
}

export type CatTWTypes = CatTWValues | CatTWPredefinedGS | CatTWCustomGS

// TODO: should not need this once TermSettingInstance is replaced with simply using the class as the type
export type CategoricalTermSettingInstance = TermSettingInstance & {
	q: CategoricalQ & { mode: 'binary' | 'discrete' }
	term: CategoricalTerm
	category2samplecount: any
	validateGroupsetting: () => { text: string; bgcolor?: string }
	error?: string
}
