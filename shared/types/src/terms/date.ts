import type { NumericBaseTerm, PresetNumericBins, NumTWTypes } from '../index.ts'

/*
--------EXPORTED--------
DateTerm
DateTW
DateTermSettingInstance
*/

export type DateTerm = NumericBaseTerm & {
	name?: string
	type: 'date'
	metabolite: string
	bins?: PresetNumericBins
	unit?: string
}

export type DateTW = NumTWTypes & { term: DateTerm }
