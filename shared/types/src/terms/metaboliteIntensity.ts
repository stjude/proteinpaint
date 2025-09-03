import type { NumericBaseTerm, PresetNumericBins, NumTW, RawNumTW } from '../index.ts'

/*
--------EXPORTED--------
MetaboliteIntensityTermWrapper
MetaboliteIntensityTermSettingInstance

*/

export type MetaboliteIntensityTerm = NumericBaseTerm & {
	name: string
	type: 'metaboliteIntensity'
	metabolite: string
	bins?: PresetNumericBins
	unit?: string
}

export type MetaboliteIntensityTW = NumTW & { term: MetaboliteIntensityTerm }

type RawMetabolitIntensityTerm = {
	type: 'metaboliteIntensity'
	metabolite: string
	name?: string
	bins?: PresetNumericBins
	unit?: string
}

export type RawMetaboliteIntensityTW = RawNumTW & { term: RawMetabolitIntensityTerm }
