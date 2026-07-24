import type { ErrorResponse } from './errorResponse.ts'

export type SectionEntry = {
    //TODO: Cannot leave this blank or eslint will complain. Need to define the structure of an entry section
    id: string
}[]


export type MemberEntry = {
    //These are terms - either from the termdb or in termtype2terms[TermTypeGroup]. 
    id: string
}[]

export type TermdbAggregateMatrixRequest = {
    genome: string
    dslabel: string
    entries: { [section: string]: SectionEntry }
    categories: { [member: string]: MemberEntry }
    /** Aggregation method to determine the color gradient. */
    gradientMethod: string
    /** Aggregation method to determine the dot sizes. */
    sizeMethod: string
    filter?: any
    filter0?: any
}

export type HasValidAggMatrixResponse = object

// {
//     //TODO: define the structure of a valid aggregate matrix response
// }

export type TermdbAggregateMatrixResponse = HasValidAggMatrixResponse | ErrorResponse