import { TermWrapper, BaseQ } from '../termdb'
import { TermSettingInstance } from '../termsetting'

/*
--------EXPORTED--------
CategoricalQ
CategoricalTW
CategoricaTermSettingInstance

*/

export type CategoricalQ = BaseQ & {
	// termType: 'categorical'
	//Not sure if separate categorical q is needed??
}

export type CategoricalTW = TermWrapper & {
	q: CategoricalQ
}

type Cat2SampleCntEntry = { key: string; count: number }

export type CategoricalTermSettingInstance = TermSettingInstance & {
	category2samplecount: Cat2SampleCntEntry[]
	error: string
	q: CategoricalQ
	//Methods
	getQlst: () => void
	grpSet2valGrp: (f: any) => void
	regroupMenu: (x?: any, y?: any) => void //Not defined
	showGrpOpts: (div: any) => any
	validateGroupsetting: () => void
}
