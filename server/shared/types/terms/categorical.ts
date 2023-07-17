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

	//THIS IS A MISTAKE! These are condition attributes and should be removed
	// bar_by_children?: boolean
	// bar_by_grade?: boolean
	// value_by_max_grade?: boolean
	// value_by_most_recent?: boolean
	// value_by_computable_grade?: boolean
	//End condition attributes
}

export type CategoricalTW = TermWrapper & {
	q: CategoricalQ
}

type Cat2SampleCntEntry = { key: string; count: number }

export type CategoricaTermSettingInstance = TermSettingInstance & {
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
