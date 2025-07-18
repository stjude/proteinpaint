import type {
	BaseTerm,
	TermValues,
	GroupSettingQ,
	ValuesQ,
	PredefinedTermGroupSetting,
	OtherTermGroupSetting,
	BaseTW,
	PredefinedGroupSettingQ,
	CustomGroupSettingQ
} from './term.ts'
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
	term: CategoricalOtherTerm
	q: RawValuesQ
}

export type RawCatTWPredefinedGS = BaseTW & {
	type?: 'CatTWPredefinedGS'
	term: CategoricalPredefinedGsTerm
	q: RawPredefinedGroupsetQ
}

export type RawCatTWCustomGS = BaseTW & {
	type?: 'CatTWCustomGS'
	term: CategoricalOtherTerm
	q: RawCustomGroupsetQ
}

export type RawCatTW = RawCatTWValues | RawCatTWPredefinedGS | RawCatTWCustomGS

export type CategoricalBaseQ = MinBaseQ & {
	mode?: 'discrete' | 'binary'
}

export type CategoricalQ = GroupSettingQ | ValuesQ

type BaseCategoricalTerm = BaseTerm & {
	type: 'categorical'
	values: TermValues
}

export type CategoricalPredefinedGsTerm = BaseCategoricalTerm & {
	groupsetting: PredefinedTermGroupSetting
}

type CategoricalOtherTerm = BaseCategoricalTerm & {
	groupsetting: OtherTermGroupSetting
}

export type CategoricalTerm = CategoricalPredefinedGsTerm | CategoricalOtherTerm

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
	term: CategoricalOtherTerm
	q: ValuesQ
	type: 'CatTWValues'
	// do not use this boolean flag, defined here only to help illustrate
	// in tw/test/fake/app.js why this is type check error prone and
	// less preferred than a discriminant prop that also works at runtime
	isCatTWValues?: true
}

export type CatTWPredefinedGS = BaseTW & {
	//id: string
	term: CategoricalPredefinedGsTerm
	q: PredefinedGroupSettingQ
	type: 'CatTWPredefinedGS'
	// do not use this boolean flag, defined here only to help illustrate
	// in tw/test/fake/app.js why this is type check error prone and
	// less preferred than a discriminant prop that also works at runtime
	isCatTWPredefiendGS?: true
}

export type CatTWCustomGS = BaseTW & {
	//id: string
	term: CategoricalOtherTerm
	q: CustomGroupSettingQ
	type: 'CatTWCustomGS'
}

export type CatTWTypes = CatTWValues | CatTWPredefinedGS | CatTWCustomGS

export type CategoricalTermSettingInstance = TermSettingInstance & {
	q: CategoricalQ
	term: CategoricalTerm
	category2samplecount: any
	validateGroupsetting: () => { text: string; bgcolor?: string }
	error?: string
}
