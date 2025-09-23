import type {
	BaseTW,
	MinBaseQ,
	BaseTerm,
	GroupSettingQ,
	TermGroupSetting,
	ValuesQ,
	PredefinedGroupSettingQ,
	CustomGroupSettingQ
} from '../index.ts'
import type { RawValuesQ, RawPredefinedGroupsetQ, RawCustomGroupsetQ } from './q.ts'

/*
For term type 'snp'
*/

export type RawSnpTWValues = BaseTW & {
	type?: 'SnpTWValues'
	/** must already exist, for dictionary terms, TwRouter.fill() will use mayHydrateDictTwLst() */
	term: SnpTerm
	q: RawValuesQ
}

export type RawSnpTWPredefinedGS = BaseTW & {
	type?: 'SnpTWPredefinedGS'
	term: SnpTerm
	q: RawPredefinedGroupsetQ
}

export type RawSnpTWCustomGS = BaseTW & {
	type?: 'SnpTWCustomGS'
	term: SnpTerm
	q: RawCustomGroupsetQ
}

export type RawSnpTW = RawSnpTWValues | RawSnpTWPredefinedGS | RawSnpTWCustomGS

export type SnpQ = MinBaseQ & GroupSettingQ

export type SnpTerm = BaseTerm & {
	type: 'snp'
	chr: string
	start: number
	stop: number
	ref: string
	alt: string[]
	groupsetting: TermGroupSetting
}

export type SnpTWValues = BaseTW & {
	//id: string
	term: SnpTerm
	q: ValuesQ
	type: 'SnpTWValues'
}

export type SnpTWPredefinedGS = BaseTW & {
	//id: string
	term: SnpTerm
	q: PredefinedGroupSettingQ
	type: 'SnpTWPredefinedGS'
}

export type SnpTWCustomGS = BaseTW & {
	//id: string
	term: SnpTerm
	q: CustomGroupSettingQ
	type: 'SnpTWCustomGS'
}

export type SnpTW = SnpTWValues | SnpTWPredefinedGS | SnpTWCustomGS
