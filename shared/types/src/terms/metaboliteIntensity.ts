import type { NumericBaseTerm, PresetNumericBins, NumTWTypes, RawNumTW } from '../index.ts'

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

type RawMetabolitIntensityTerm = {
	type: 'metaboliteIntensity'
	metabolite: string
}

export type RawMetaboliteIntensityTW = RawNumTW & { term: RawMetabolitIntensityTerm }
