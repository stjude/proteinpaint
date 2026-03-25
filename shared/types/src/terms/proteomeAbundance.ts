import type { NumericBaseTerm, PresetNumericBins, NumTW, RawNumTW } from '../index.ts'

/*
--------EXPORTED--------
ProteomeTermWrapper
ProteomeTermSettingInstance

*/

export type ProteomeAbundanceTerm = NumericBaseTerm & {
	id?: string
	name: string
	type: 'proteomeAbundance'
	protein: string
	bins?: PresetNumericBins
	unit?: string
	/** assay key identifying which proteome assay this term belongs to */
	assayKey: string
	/** cohort key identifying which cohort within the assay this term belongs to */
	cohortKey: string
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
