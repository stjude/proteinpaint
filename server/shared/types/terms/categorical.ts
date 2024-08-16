import { BaseTerm, TermValues, MinBaseQ, GroupSettingQ, ValuesQ, TermGroupSetting, BaseTW } from './term.ts'
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
	q: MinBaseQ &
		(
			| {
					type?: 'values'
			  }
			| {
					type: 'predefined-groupset'
					predefined_groupset_idx?: number
					groupsetting?: GroupSettingQ // deprecated nested object, will be handled by reshapeLegacyTW() in RootTW
			  }
			| {
					type: 'custom-groupset'
					customset: any
					groupsetting?: GroupSettingQ // deprecated nested object, will be handled by reshapeLegacyTW() in RootTW
			  }
		)
	isAtomic: true
	$id?: string
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
