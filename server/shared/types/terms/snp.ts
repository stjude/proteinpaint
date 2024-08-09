import { TermWrapper } from './tw'
import { BaseQ, BaseTerm, GroupSettingQ, TermGroupSetting } from './term'
import { TermSettingInstance } from '../termsetting'

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
