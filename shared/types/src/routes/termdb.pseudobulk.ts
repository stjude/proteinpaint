import type { ErrorResponse } from './errorResponse.ts'
import { type PseudobulkTerm, PseudobulkAssay } from '../terms/pseudobulk.ts'

export type GetPseudobulkDataArg = {
    termlst: PseudobulkTerm[]
    assay: typeof PseudobulkAssay[number]
    /** memberId is also termId in the dataset */
    memberId: string
}

export type TermdbPseudobulkRequest = {
    /** Genome id */
    genome: string
    /** Dataset label */
    dslabel: string
    termlst: PseudobulkTerm[]
}

export type HasPseudobulkDataResponse = {
    //TODO
    data: any
}

export type TermdbPseudobulkResponse = ErrorResponse | HasPseudobulkDataResponse