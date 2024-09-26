import { TermWrapper } from './tw.ts'
import { BaseQ } from './term.ts'
import { NumericTerm } from './numeric.ts'
import { TermSettingInstance } from '../termsetting.ts'

/*
--------EXPORTED--------
MetaboliteIntensityQ
MetaboliteIntensityTermWrapper
MetaboliteIntensityTermSettingInstance

*/

export type MetaboliteIntensityQ = BaseQ & {
	mode: 'continuous'
}

export type MetaboliteIntensityTW = TermWrapper & {
	q: MetaboliteIntensityQ
	term: MetaboliteIntensityTerm
}

export type MetaboliteIntensityTerm = NumericTerm & {
	metabolite: string
	bins: any
}

export type MetaboliteIntensityTermSettingInstance = TermSettingInstance & {
	q: MetaboliteIntensityQ
	term: MetaboliteIntensityTerm
}
