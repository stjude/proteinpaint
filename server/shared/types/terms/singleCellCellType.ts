import { BaseTerm, BaseValue, BaseQ, BaseTW, QGroupSetting, TermGroupSetting, ValuesGroup } from './term.ts'

/*
--------EXPORTED--------
CategoricalValuesObject
GroupSet
SingleCellCellTypeTerm
SingleCellQ
SingleCellCellTypeTW
GroupSetInputValues

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
}

export type GroupSet = {
	mode: 'binary' | 'discrete'
	type?: 'predefined-groupset' | 'custom-groupset'
	name: string
	groups: ValuesGroup[]
}

export type SingleCellCellTypeTerm = BaseTerm & {
	type: 'singleCellCellType'
	/** the cell types may be also cell attributes like CNV, Fusion, etc */
	values: CategoricalValuesObject
	/** single cell terms require a sample to read the term values, they are associated with a sample */
	sample: string
	/** the plot defined in the dataset contains a column with the term values for the sample, it needs to be passed to read the sample values */
	plot: string
	groupsetting: TermGroupSetting & { useIndex: number }
}

export type SingleCellQ = BaseQ & QGroupSetting & (CategoricalValuesObject | GroupSet)

export type SingleCellCellTypeTW = BaseTW & {
	term: SingleCellCellTypeTerm
	q: SingleCellQ
}

export type GroupSetInputValues = {
	[index: string]: {
		/** value's label on client */
		label?: string | number
		/** value's current group index */
		group?: number
	}
}
