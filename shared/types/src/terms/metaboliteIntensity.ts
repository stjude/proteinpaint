import type { BaseTW, NumericBaseTerm, NumericQ, PresetNumericBins } from '../index.ts'
import type { TermSettingInstance } from '../termsetting.ts'

/*
--------EXPORTED--------
MetaboliteIntensityTermWrapper
MetaboliteIntensityTermSettingInstance

*/

export type MetaboliteIntensityTW = BaseTW & {
	type: 'NumTWCont'
	q: NumericQ
	term: MetaboliteIntensityTerm
}

export type MetaboliteIntensityTerm = NumericBaseTerm & {
	name?: string
	type: 'metaboliteIntensity'
	metabolite: string
	bins?: PresetNumericBins
	unit?: string
}

export type MetaboliteIntensityTermSettingInstance = TermSettingInstance & {
	q: NumericQ
	term: MetaboliteIntensityTerm
}
