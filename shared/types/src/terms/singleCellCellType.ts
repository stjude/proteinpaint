import type { BaseTerm, TermGroupSetting, TermValues } from '../index.ts'

export type SingleCellCellTypeTerm = BaseTerm & {
	type: 'singleCellCellType'
	/** the cell types may be also cell attributes like CNV, Fusion, etc */
	/** single cell terms require a sample to read the term values, they are associated with a sample */
	sample: string
	/** the plot defined in the dataset contains a column with the term values for the sample, it needs to be passed to read the sample values */
	plot: string
	groupsetting: TermGroupSetting
	// may be used to hide
	values: TermValues
}

export type RawSingleCellCellTypeTerm = SingleCellCellTypeTerm & {
	groupsetting?: TermGroupSetting
	values?: TermValues
}
