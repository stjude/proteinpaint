import type { BaseTerm, BaseTW, GroupSettingQ, TermGroupSetting, TermValues } from '../index.ts'
import type { MinBaseQ } from './q.ts'

type SingleCellCellTypeBaseQ = MinBaseQ & { mode: 'discrete' | 'binary' }

export type SingleCellCellTypeQ = SingleCellCellTypeBaseQ & GroupSettingQ

export type SingleCellCellTypeTerm = BaseTerm & {
	type: 'singleCellCellType'
	/** the cell types may be also cell attributes like CNV, Fusion, etc */
	values: TermValues
	/** single cell terms require a sample to read the term values, they are associated with a sample */
	sample: string
	/** the plot defined in the dataset contains a column with the term values for the sample, it needs to be passed to read the sample values */
	plot: string
	groupsetting: TermGroupSetting
}

export type SingleCellCellTypeTW = BaseTW & {
	term: SingleCellCellTypeTerm
	q: SingleCellCellTypeQ
}
