import type { NumericBaseTerm, PresetNumericBins, NumTW, RawNumTW } from '../index.ts'

/*
--------EXPORTED--------
ProteomeTermWrapper
ProteomeTermSettingInstance

*/

export type ProteomeDetails = {
	assay: string
	cohort: string
}

export type ProteomeAbundanceTerm = NumericBaseTerm & {
	id?: string
	name: string
	type: 'proteomeAbundance'
	protein: string
	bins?: PresetNumericBins
	unit?: string
	/** assay and cohort this term belongs to */
	proteomeDetails: ProteomeDetails
}

export type ProteomeAbundanceTW = NumTW & { term: ProteomeAbundanceTerm }

export type RawProteomeAbundanceTerm = NumericBaseTerm & {
	id?: string
	type: 'proteomeAbundance'
	protein: string
	name?: string
	bins?: PresetNumericBins
	unit?: string
}

export type RawProteomeAbundanceTW = RawNumTW & { term: RawProteomeAbundanceTerm }
