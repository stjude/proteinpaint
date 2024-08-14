import { BaseTerm, TermValues, MinBaseQ, GroupSettingQ, TermGroupSetting, BaseTW } from './term.ts'
import { TermSettingInstance } from '../termsetting.ts'

/**
 * A categorical term q object
 *
 * test:CategoricalQ:
 *
 * @category TW
 */

type CategoricalBaseQ = MinBaseQ & { mode: 'discrete' | 'binary' }

export type CategoricalQ = CategoricalBaseQ & GroupSettingQ

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
	id: string
	q: CategoricalQ
	term: CategoricalTerm
}

export type CategoricalTermSettingInstance = TermSettingInstance & {
	q: CategoricalQ
	term: CategoricalTerm
	category2samplecount: any
	validateGroupsetting: () => { text: string; bgcolor?: string }
	error?: string
}
