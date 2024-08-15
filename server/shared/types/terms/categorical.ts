import { BaseTerm, TermValues, MinBaseQ, GroupSettingQ, TermGroupSetting, BaseTW } from './term.ts'
import { TermSettingInstance } from '../termsetting.ts'

/**
 * A categorical term q object
 *
 * test:CategoricalQ:
 *
 * @category TW
 */

export type RawCatTW = {
	id: string
	term: {
		type: 'categorical'
		id: string
		name?: string
		values?:
			| Record<string, never> // empty object
			| {
					[key: string | number]: { label?: string; key?: string }
			  }
		groupsetting?: TermGroupSetting
	}
	q?: {
		type?: string
		mode?: string
		isAtomic: true
		groupsetting?: GroupSettingQ // deprecated nested object, must support and reapply to root q object
	}
	//isAtomic?: true
	//$id?: string
}

export type CategoricalValuesObject = {
	//mode: 'binary' | 'discrete'
	type?: 'values'
}

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

export type CategoricalTW = {
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
