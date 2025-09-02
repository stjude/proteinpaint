import type { BaseTW, NumericBaseTerm, NumericQ, PresetNumericBins } from '../index.ts'
import type { TermSettingInstance } from '../termsetting.ts'

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
	bins: PresetNumericBins
	unit?: string
}

export type DateTW = BaseTW & {
	type: 'NumTWCont'
	q: NumericQ
	term: DateTerm
}

export type DateTermSettingInstance = TermSettingInstance & {
	q: NumericQ
	term: DateTerm
}
