import { Term, TermWrapper, BaseQ } from '../termdb'
import { TermSettingInstance } from '../termsetting'

/*
--------EXPORTED--------
SampleLstTerm
SampleLstTW
SampleLstSettingInstance

*/

export type SampleLstTermValues = {
	name: string
	inuse: boolean
	list: { sampleId: string; sample: string }[]
	values: any
}

export type SampleLstQ = BaseQ & {
	groups: SampleLstTermValues
}

export type SampleLstTerm = Term & {
	values: SampleLstTermValues
}

export type SampleLstTW = TermWrapper & {
	q: SampleLstQ
	term: SampleLstTerm
}

//temporary, will eventually change to SampleLstHandler
export type SampleLstSettingInstance = TermSettingInstance & {
	q: SampleLstQ
	term: SampleLstTerm
}
