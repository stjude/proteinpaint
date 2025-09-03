import type { NumericBaseTerm, PresetNumericBins, NumTW, RawNumTW } from '../index.ts'

/*
--------EXPORTED--------
DateTerm
DateTW
DateTermSettingInstance
*/

export type DateTerm = NumericBaseTerm & {
	name: string
	type: 'date'
	bins?: PresetNumericBins
}

export type DateTW = NumTW & { term: DateTerm }

type RawDateTerm = DateTerm & { name?: string }

export type RawDateTW = RawNumTW & { term: RawDateTerm }
