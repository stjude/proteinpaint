import type { ErrorResponse } from './errorResponse.ts'

export type TermdbAggregateMatrixRequest = {
    genome: string
    dslabel: string
}

export type HasValidAggMatrixResponse = object

// {
//     //TODO: define the structure of a valid aggregate matrix response
// }

export type TermdbAggregateMatrixResponse = HasValidAggMatrixResponse | ErrorResponse