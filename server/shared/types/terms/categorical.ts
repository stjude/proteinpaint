import {
	BaseTerm,
	TermValues,
	GroupSettingQ,
	ValuesQ,
	TermGroupSetting,
	BaseTW,
	PredefinedGroupSettingQ,
	CustomGroupSettingQ
} from './term.ts'
import { RawValuesQ, RawPredefinedGroupsetQ, RawCustomGroupsetQ } from './q.ts'
import { TermSettingInstance } from '../termsetting.ts'

/**
 * A raw categorical term q object, before filling-in
 *
 * test:CategoricalQ:
 *
 * @category TW
 */

export type RawCatTW = {
	// id: string
	type?: 'CatTWValues' | 'CatTWPredefinedGS' | 'CatTWCustomGS'
	term: CategoricalTerm // must already exist, for dictionary terms, TwRouter.fill() will use mayHydrateDictTwLst()
	q: RawValuesQ | RawPredefinedGroupsetQ | RawCustomGroupsetQ
	isAtomic?: true
	$id?: string
}

//export type RawCatTW = RawCatTWValues | RawCatTWPredefinedGS | RawCatTWCustomGS

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
	// do not use this boolean flag, defined here only to help illustrate
	// in tw/test/fake/app.js why this is type check error prone and
	// less preferred than a discriminant prop that also works at runtime
	isCatTWValues?: true
}

export type CatTWPredefinedGS = BaseTW & {
	//id: string
	term: CategoricalTerm
	q: PredefinedGroupSettingQ
	type: 'CatTWPredefinedGS'
	// do not use this boolean flag, defined here only to help illustrate
	// in tw/test/fake/app.js why this is type check error prone and
	// less preferred than a discriminant prop that also works at runtime
	isCatTWPredefiendGS?: true
}

export type CatTWCustomGS = BaseTW & {
	//id: string
	term: CategoricalTerm
	q: CustomGroupSettingQ
	type?: 'CatTWCustomGS'
}

export type CatTWTypes = CatTWValues | CatTWPredefinedGS | CatTWCustomGS

export type CategoricalTermSettingInstance = TermSettingInstance & {
	q: CategoricalQ
	term: CategoricalTerm
	category2samplecount: any
	validateGroupsetting: () => { text: string; bgcolor?: string }
	error?: string
}
