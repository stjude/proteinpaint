import type { BaseTW, BaseQ, BaseTerm, GroupSettingQ, TermGroupSetting } from './term.ts'
import type { TermSettingInstance } from '../termsetting.ts'

/*
For term type 'snp'
*/

export type SnpQ = BaseQ & GroupSettingQ

export type SnpTerm = BaseTerm & {
	chr: string
	start: number
	stop: number
	ref: string
	alt: string[]
	groupsetting: TermGroupSetting
}

export type SnpTW = BaseTW & {
	type: 'SnpTW'
	q: SnpQ
	term: SnpTerm
}

export type SnpTermSettingInstance = TermSettingInstance & {
	q: SnpQ
	term: SnpTerm
}
