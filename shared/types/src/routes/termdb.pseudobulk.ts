import type { ErrorResponse } from './errorResponse.ts'

export type TermdbPseudobulkRequest = {
    /** Genome id */
    genome: string
    /** Dataset label */
    dslabel: string
}

export type HasPseudobulkDataResponse = {
    //TODO
    data: any
}

export type TermdbPseudobulkResponse = ErrorResponse | HasPseudobulkDataResponse