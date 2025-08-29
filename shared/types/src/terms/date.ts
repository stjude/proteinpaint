import type { BaseQ, BaseTW, NumericBaseTerm } from '../index.ts'
import type { TermSettingInstance } from '../termsetting.ts'

/*
--------EXPORTED--------
MetaboliteIntensityQ
MetaboliteIntensityTermWrapper
MetaboliteIntensityTermSettingInstance

*/

export type DateQ = BaseQ & {
	mode: 'continuous'
}

export type DateTW = BaseTW & {
	type: string // 'NumTWCont'
	q: DateQ
	term: DateTerm
}

export type DateTerm = NumericBaseTerm & {
	name?: string
	type: 'date'
	metabolite: string
	bins: any
	unit?: string
}

export type DateTermSettingInstance = TermSettingInstance & {
	q: DateQ
	term: DateTerm
}
