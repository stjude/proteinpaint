import { BaseTerm, TermValues, MinBaseQ, GroupSettingQ, GroupEntry, ValuesQ, TermGroupSetting, BaseTW } from './term.ts'
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
	term: CategoricalTerm
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
					customset: {
						groups: GroupEntry[]
					}
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
