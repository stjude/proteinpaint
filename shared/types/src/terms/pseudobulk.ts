import type { NumericBaseTerm, NumTW, RawNumTW } from '../index.ts'

export const PseudobulkAssay = ['geneExpression'] as const //Add more assays here

export type PseudobulkTerm = NumericBaseTerm & {
    type: 'pseudobulk'
    /** Corresponds to the singleCell.pseudobulk[assayType] */
    assay: typeof PseudobulkAssay[number]
    /** Corresponds to the singleCell.pseudobulk[assayType][termId] */
    memberId: string
}

export type PseudobulkTW = NumTW & { term: PseudobulkTerm }

export type RawPseudobulkTerm = PseudobulkTerm & { name?: string }

export type RawPseudobulkTW = RawNumTW & { term: RawPseudobulkTerm }