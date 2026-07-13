import type { NumericBaseTerm, NumTW, RawNumTW } from '../index.ts'

export const PseudobulkAssay = 'geneExpression' //Add more assays here

export type PseudobulkTerm = NumericBaseTerm & {
    type: 'pseudobulk'
    assay: typeof PseudobulkAssay
    termid: string
}

export type PseudobulkTW = NumTW & { term: PseudobulkTerm }

export type RawPseudobulkTerm = PseudobulkTerm & { name?: string }

export type RawPseudobulkTW = RawNumTW & { term: RawPseudobulkTerm }