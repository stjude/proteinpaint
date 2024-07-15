import { TermWrapper } from './tw.js'
import { BaseQ, BaseTerm } from './term.js'
import { TermSettingInstance } from '../termsetting.js'

/*
For term type 'snp'
*/

export type SnpQ = BaseQ

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
}

export type SnpTermSettingInstance = TermSettingInstance & {
	q: SnpQ
	term: SnpTerm
}
