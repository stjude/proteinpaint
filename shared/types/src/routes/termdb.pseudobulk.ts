import type { ErrorResponse } from './errorResponse.ts'
import type { PseudobulkTerm, PseudobulkAssay } from '../terms/pseudobulk.ts'

type TermLstEntry = PseudobulkTerm & { genes: string[] }

export type GetPseudobulkDataArg = {
    termlst: TermLstEntry[]
    assay: typeof PseudobulkAssay[number]
    /** memberId is also termId in the dataset */
    memberId: string
}

export type TermdbPseudobulkRequest = {
    /** Genome id */
    genome: string
    /** Dataset label */
    dslabel: string
    termlst: TermLstEntry[]
}

export type HasPseudobulkDataResponse = {
    //TODO
    data: any
}

export type TermdbPseudobulkResponse = ErrorResponse | HasPseudobulkDataResponse