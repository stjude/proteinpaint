import { TermWrapper } from './tw.ts'
import { BaseQ, BaseTerm, GroupSettingQ, TermGroupSetting } from './term.ts'
import { TermSettingInstance } from '../termsetting.ts'

/*
For term type 'snp'
*/

export type SnpQ = BaseQ & GroupSettingQ

export type SnpTW = TermWrapper & {
	q: SnpQ
	term: SnpTerm
}

export type SnpTerm = BaseTerm & {
	chr: string
	start: number
	stop: number
	ref: string
	alt: string[]
	groupsetting: TermGroupSetting
}

export type SnpTermSettingInstance = TermSettingInstance & {
	q: SnpQ
	term: SnpTerm
}
