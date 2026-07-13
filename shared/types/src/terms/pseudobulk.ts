import type { BaseTerm } from '../index.ts'

export const PseudobulkAssay = 'geneExpression' //Add more assays here

export type PseudobulkTerm = BaseTerm & {
    type: 'pseudobulk'
    assay: typeof PseudobulkAssay
    termid: string
}

export type RawPseudobulkTerm = PseudobulkTerm & {
    //TODO
}