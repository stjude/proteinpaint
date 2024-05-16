import { Term, BaseQ } from './term.ts'
import { TermWrapper } from './tw.js'
import { TermSettingInstance } from '../termsetting.ts'

/*
--------EXPORTED--------
SampleLstTermValues
SampleLstQ
SampleLstTerm
SampleLstTW
SampleLstSettingInstance

*/

export type SampleLstTermValues = {
	[index: string | number]: {
		name: string
		inuse: boolean
		list: { sampleId: string; sample: string }[]
		values: any
	}
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
export type SampleLstTermSettingInstance = TermSettingInstance & {
	q: SampleLstQ
	term: SampleLstTerm
}
