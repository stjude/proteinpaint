import type { BaseQ, BaseTW, NumericBaseTerm } from '../index'
import type { TermSettingInstance } from '../termsetting.ts'

/*
--------EXPORTED--------
MetaboliteIntensityQ
MetaboliteIntensityTermWrapper
MetaboliteIntensityTermSettingInstance

*/

export type MetaboliteIntensityQ = BaseQ & {
	mode: 'continuous'
}

export type MetaboliteIntensityTW = BaseTW & {
	type: string // 'NumTWCont'
	q: MetaboliteIntensityQ
	term: MetaboliteIntensityTerm
}

export type MetaboliteIntensityTerm = NumericBaseTerm & {
	name?: string
	type: 'metaboliteIntensity'
	metabolite: string
	bins: any
	unit?: string
}

export type MetaboliteIntensityTermSettingInstance = TermSettingInstance & {
	q: MetaboliteIntensityQ
	term: MetaboliteIntensityTerm
}
