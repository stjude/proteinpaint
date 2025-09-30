import type { NumericBaseTerm, PresetNumericBins, NumTW, RawNumTW } from '../index.ts'

/*
--------EXPORTED--------
MetaboliteIntensityTermWrapper
MetaboliteIntensityTermSettingInstance

*/

export type MetaboliteIntensityTerm = NumericBaseTerm & {
	id?: string
	name: string
	type: 'metaboliteIntensity'
	metabolite: string
	bins?: PresetNumericBins
	unit?: string
}

export type MetaboliteIntensityTW = NumTW & { term: MetaboliteIntensityTerm }

export type RawMetaboliteIntensityTerm = NumericBaseTerm & {
	id?: string
	type: 'metaboliteIntensity'
	metabolite: string
	name?: string
	bins?: PresetNumericBins
	unit?: string
}

export type RawMetaboliteIntensityTW = RawNumTW & { term: RawMetaboliteIntensityTerm }
