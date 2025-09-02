import type { NumericBaseTerm, PresetNumericBins, NumTWTypes, RawNumTW } from '../index.ts'

/*
--------EXPORTED--------
DateTerm
DateTW
DateTermSettingInstance
*/

export type DateTerm = NumericBaseTerm & {
	name?: string
	type: 'date'
	bins?: PresetNumericBins
	unit?: string
}

export type DateTW = NumTWTypes & { term: DateTerm }

type RawDateTerm = {
	type: 'date'
}

export type RawDateTW = RawNumTW & { term: RawDateTerm }
