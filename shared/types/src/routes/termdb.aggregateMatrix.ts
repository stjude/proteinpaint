import type { ErrorResponse } from './errorResponse.ts'
import type { TermWrapper } from '../terms/tw.ts'

export type TermdbAggregateMatrixRequest = {
    genome: string
    dslabel: string
    entries: { [section: string]: TermWrapper[] }
    categories: { [member: string]: TermWrapper[] }
    /** Aggregation method to determine the color gradient. */
    gradientMethod: string
    /** Aggregation method to determine the dot sizes. */
    sizeMethod: string
    /** Min size of the dots in pixels */
    minDotSize: number
     /** Max size of the dots in pixels */
    maxDotSize: number
    filter?: any
    filter0?: any
} 

export type AggMatrixDot = {
    /** Category identifier */
    category: string
    /** Member identifier within the category */
    member: string
    /** Raw aggregate value mapped to color gradient */
    colorValue: number
    /** Raw aggregate value for size (returned for tooltip display) */
    sizeValue: number
    /** Computed dot size in pixels */
    dotSize: number
}

export type AggMatrixResponseRow = {
    /** Section identifier from entries config (entries -> section -> term) */
    section: string
    /** Term identifier within the section */
    term: string
    /** Dots for this row, ordered by category -> member on the x-axis */
    dots: AggMatrixDot[]
}

export type HasValidAggMatrixResponse = {
    /** Min and max values for the color gradient */
    colorScale: { min: number, max: number }
    /** Rows ordered by section -> term on the y-axis */
    data: AggMatrixResponseRow[]
    /** x-axis member -> category order */
    xAxisOrder: { member: string, categories: string[] }[]
}

export type TermdbAggregateMatrixResponse = HasValidAggMatrixResponse | ErrorResponse