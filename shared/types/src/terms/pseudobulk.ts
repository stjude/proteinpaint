import type { NumericBaseTerm, NumTW, PresetNumericBins, RawNumTW } from '../index.ts'

export const PseudobulkAssay = ['geneExpression'] as const //Add more assays here

export type PseudobulkTerm = NumericBaseTerm & {
	type: 'pseudobulk'
	/** Corresponds to the singleCell.pseudobulk[assay] */
	assay: (typeof PseudobulkAssay)[number]
	/** Corresponds to the singleCell.pseudobulk[assay][memberId] */
	memberId: string
	/** Corresponds to one key in singleCell.pseudobulk[assay][memberId].categories{} */
	category: string
	/** gene symbol */
	gene: string
	bins?: PresetNumericBins
}

export type PseudobulkTW = NumTW & { term: PseudobulkTerm }

export type RawPseudobulkTerm = PseudobulkTerm & { name?: string }

export type RawPseudobulkTW = RawNumTW & { term: RawPseudobulkTerm }
