import type { NumericBaseTerm, PresetNumericBins, NumTW, RawNumTW } from '../index.ts'

/*
--------EXPORTED--------
ProteomeTermWrapper
ProteomeTermSettingInstance

*/

export type WholeProteomeAbundanceTerm = NumericBaseTerm & {
	id?: string
	name: string
	type: 'wholeProteomeAbundance'
	protein: string
	bins?: PresetNumericBins
	unit?: string
}

export type WholeProteomeAbundanceTW = NumTW & { term: WholeProteomeAbundanceTerm }

export type RawWholeProteomeAbundanceTerm = NumericBaseTerm & {
	id?: string
	type: 'wholeProteomeAbundance'
	protein: string
	name?: string
	bins?: PresetNumericBins
	unit?: string
}

export type RawWholeProteomeAbundanceTW = RawNumTW & { term: RawWholeProteomeAbundanceTerm }
