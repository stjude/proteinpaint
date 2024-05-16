import { TermWrapper, BaseQ, Term } from '../termdb.ts'
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

export type MetaboliteIntensityTerm = Term & {
	metabolite: string
	bins: any
}

export type MetaboliteIntensityTermSettingInstance = TermSettingInstance & {
	q: MetaboliteIntensityQ
	term: MetaboliteIntensityTerm
}
