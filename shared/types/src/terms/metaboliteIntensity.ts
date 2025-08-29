import type { BaseTW, NumericBaseTerm, NumericQ } from '../index'
import type { TermSettingInstance } from '../termsetting.ts'

/*
--------EXPORTED--------
MetaboliteIntensityTermWrapper
MetaboliteIntensityTermSettingInstance

*/

export type MetaboliteIntensityTW = BaseTW & {
	type: string // 'NumTWCont'
	q: NumericQ
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
	q: NumericQ
	term: MetaboliteIntensityTerm
}
