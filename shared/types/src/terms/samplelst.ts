import type { BaseTerm, MinBaseQ } from '../index.ts'
import type { TermWrapper } from './tw.ts'
import type { TermSettingInstance } from '../termsetting.ts'

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

export type SampleLstQ = MinBaseQ & {
	groups: SampleLstTermValues
}

export type SampleLstTerm = BaseTerm & {
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
