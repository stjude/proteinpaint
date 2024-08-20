import {
	BaseTerm,
	TermValues,
	MinBaseQ,
	GroupSettingQ,
	GroupEntry,
	ValuesQ,
	TermGroupSetting,
	BaseTW,
	PredefinedGroupSettingQ,
	CustomGroupSettingQ
} from './term.ts'
import { TermSettingInstance } from '../termsetting.ts'

/**
 * A raw categorical term q object, before filling-in
 *
 * test:CategoricalQ:
 *
 * @category TW
 */

export type RawCatTW = {
	id: string
	term: CategoricalTerm // must already exist, for dictionary terms, TwRouter.fill() will use mayHydrateDictTwLst()
	q: MinBaseQ &
		(
			| {
					type?: 'values'
			  }
			| {
					type: 'predefined-groupset'
					predefined_groupset_idx?: number
					groupsetting?: { inuse?: boolean } & GroupSettingQ // deprecated nested object, will be handled by reshapeLegacyTW() in TwRouter
			  }
			| {
					type: 'custom-groupset'
					customset: {
						groups: GroupEntry[]
					}
					groupsetting?: { inuse?: boolean } & GroupSettingQ // deprecated nested object, will be handled by reshapeLegacyTW() in TwRouter
			  }
		)
	isAtomic?: true
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

export type CatTWValues = BaseTW & {
	id: string
	term: CategoricalTerm
	q: ValuesQ
}

export type CatTWPredefinedGS = BaseTW & {
	id: string
	term: CategoricalTerm
	q: PredefinedGroupSettingQ
}

export type CatTWCustomGS = BaseTW & {
	id: string
	term: CategoricalTerm
	q: CustomGroupSettingQ
}

//export type CategoricalTW = CatTWValues | CatTWPredefinedGS | CatTWCustomGS

export type CategoricalTermSettingInstance = TermSettingInstance & {
	q: CategoricalQ
	term: CategoricalTerm
	category2samplecount: any
	validateGroupsetting: () => { text: string; bgcolor?: string }
	error?: string
}
