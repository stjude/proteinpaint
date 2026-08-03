import type { ErrorResponse } from './errorResponse.ts'
import type { TermWrapper } from '../terms/tw.ts'

export type TermdbAggregateMatrixRequest = {
    genome: string
    dslabel: string
    rows: { [section: string]: TermWrapper[] }
    columns: { [member: string]: TermWrapper[] }
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
    /** Category term identifier (the value/level within a member) */
    column: string
    /** Raw aggregate value mapped to color gradient */
    colorValue: number
    /** Raw aggregate value for size (returned for tooltip display) */
    sizeValue: number
    /** Computed dot size in pixels */
    dotSize: number
    /** Entry term identifier (the value/level within a section) */
    row: string
}

export type AxisTermEntry = { id: string, label: string }

export type AxisSection = {
    id: string
    /** Entry terms within this section, ordered as rows */
    terms: AxisTermEntry[]
}

export type AxesLayout = {
    /** Y-axis layout: sections -> row terms */
    rows: {
        sections: AxisSection[]
        /** Total row count across all sections */
        rowCount: number
        /** The longest row label, for axis sizing */
        longestLabel: string
    }
    /** X-axis layout: sections -> col terms */
    columns: {
        sections: AxisSection[]
        /** Total column count across all members */
        colCount: number
        /** The longest col label, for axis sizing */
        longestLabel: string
    }
}

export type HasValidAggMatrixResponse = {
    /** Min and max raw values for the color gradient */
    colorScale: { min: number, max: number }
    /** Array of rows, each row is an array of dots ordered left to right by column */
    data: AggMatrixDot[][]
    /** Axes structure for generating x/y axis labels */
    axesLayout: AxesLayout
}

export type TermdbAggregateMatrixResponse = HasValidAggMatrixResponse | ErrorResponse