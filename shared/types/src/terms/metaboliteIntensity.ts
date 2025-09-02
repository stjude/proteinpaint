import type { NumericBaseTerm, PresetNumericBins, NumTWTypes } from '../index.ts'

/*
--------EXPORTED--------
MetaboliteIntensityTermWrapper
MetaboliteIntensityTermSettingInstance

*/

export type MetaboliteIntensityTerm = NumericBaseTerm & {
	name?: string
	type: 'metaboliteIntensity'
	metabolite: string
	bins?: PresetNumericBins
	unit?: string
}

export type MetaboliteIntensityTW = NumTWTypes & { term: MetaboliteIntensityTerm }
