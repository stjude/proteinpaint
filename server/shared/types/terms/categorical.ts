import { BaseTerm, TermValues, MinBaseQ, GroupSettingQ, TermGroupSetting, BaseTW } from './term'

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
	term: CategoricalTerm
	q: CategoricalQ
}
