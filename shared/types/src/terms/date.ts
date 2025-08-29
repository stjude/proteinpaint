import type { BaseTW, NumericBaseTerm, NumericQ } from '../index.ts'
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
	bins: any
	unit?: string
}

export type DateTW = BaseTW & {
	type: string // 'NumTWCont'
	q: NumericQ
	term: DateTerm
}

export type DateTermSettingInstance = TermSettingInstance & {
	q: NumericQ
	term: DateTerm
}
