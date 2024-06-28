//import { TermWrapper, BaseQ } from '../termdb'
import {
	BaseTerm,
	BaseValue,
	TermValues,
	BaseQ,
	BaseTW,
	EmptyGroupSetting,
	PredefinedGroupSetting,
	CustomGroupSetting,
	ValuesGroup
} from './term.ts'
import { TermTypes } from '../../terms.js'

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

export type CategoricalValuesObject = {
	mode: 'binary' | 'discrete'
	type?: 'values'
	values: {
		[key: string]: BaseValue
	}
	groupsetting: EmptyGroupSetting
}

export type GroupSet = {
	mode: 'binary' | 'discrete'
	type?: 'predefined-groupset' | 'custom-groupset'
	name: string
	groups: ValuesGroup[]
	groupsetting: PredefinedGroupSetting | CustomGroupSetting | EmptyGroupSetting
}

export type SingleCellCellTypeTerm = BaseTerm & {
	type: 'singleCellCellType'
	values: CategoricalValuesObject //the cell types may be also cell attributes like CNV, Fusion, etc
	sample: string //single cell terms require a sample to read the term values, they are associated with a sample
	plot: string //the plot defined in the dataset contains a column with the term values for the sample, it needs to be passed to read the sample values
	//groupsetting: { disabled?: boolean | undefined } //, lst?: GroupSet }
}

export type CategoricalQ = BaseQ & (CategoricalValuesObject | GroupSet)

export type SingleCellCellTypeTW = BaseTW & {
	term: SingleCellCellTypeTerm
	q: CategoricalQ
}

export type GroupSetInputValues = {
	[index: string]: {
		label?: string | number //value's label on client
		group?: number //value's current group index
	}
}
