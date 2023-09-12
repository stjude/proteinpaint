import { TermWrapper, BaseQ } from '../termdb'
import { TermSettingInstance } from '../termsetting'
import { doc } from '../../doc'

/*
--------EXPORTED--------
CategoricalQ
CategoricalTW
CategoricaTermSettingInstance

*/

/**
 * A categorical term q object
 *
 * test:CategoricalQ:
 *
 * @category TW
 */
export type CategoricalQ = BaseQ & {
	// termType: 'categorical'
	//Not sure if separate categorical q is needed??
}

doc({
	type: 'CategoricalQ',
	test: t => {
		if (!t.mode.includes('groupsetting')) throw `CategoricalQ must have a '*-groupsetting' mode`
		return true
	}
})

/**
 * A categorical term wrapper object
 *
 * @group Termdb
 * @category TW
 */
export type CategoricalTW = TermWrapper & {
	q: CategoricalQ
}

type Cat2SampleCntEntry = { key: string; count: number }

export type GroupSetInputValues = {
	[index: string]: {
		label?: string | number //value's label on client
		group?: number //value's current group index
	}
}

/**
 * @group Termdb
 * @category TW
 */
export type CategoricalTermSettingInstance = TermSettingInstance & {
	category2samplecount: Cat2SampleCntEntry[]
	error: string
	q: CategoricalQ
	//Methods
	getQlst: () => void
	grpSet2valGrp: (f: any) => GroupSetInputValues
	showGrpOpts: (div: any) => any
	validateGroupsetting: () => void
	showDraggables: () => void
}
