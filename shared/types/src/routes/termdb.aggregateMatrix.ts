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
    filter?: any
    filter0?: any
}

export type AggMatrixDot = {
    /** Entry term identifier (the value/level within a section) */
    row: string
    /** Section identifier for the row */
    rowSection: string
    /** Category term identifier (the value/level within a member) */
    column: string
    /** Section identifier for the column */
    colSection: string
    /** Raw aggregate value mapped to color gradient. 
     * Maybe null if no data is available for this dot. */
    colorValue: number | null
    /** Raw aggregate value for size. Maybe null if no data is available for this dot. */
    sizeValue: number | null
}

export type AxisTermEntry = { id: string, label: string }

export type AxisSection = {
    id: string
    /** Entry terms within this section, ordered as rows */
    terms: AxisTermEntry[]
}

export type AxisLayoutRows = {
    sections: AxisSection[]
    /** Total row count across all sections */
    rowCount: number
    /** The longest row label, for axis sizing */
    longestLabel: string
}

export type AxisLayoutColumns = {
    sections: AxisSection[]
    /** Total column count across all members */
    colCount: number
    /** The longest col label, for axis sizing */
    longestLabel: string
}

export type AxesLayout = {
    /** Y-axis layout: sections -> row terms */
    rows: AxisLayoutRows
    /** X-axis layout: sections -> col terms */
    columns: AxisLayoutColumns
}

export type ValidAggMatrixResponse = {
    /** Min and max raw values for the color gradient */
    colorScale: { min: number, max: number }
    /** Min and max raw values for the dot sizes */
    sizeScale: { min: number, max: number }
    /** Array of rows, each row is an array of dots ordered left to right by column */
    data: AggMatrixDot[][]
    /** Axes structure for generating x/y axis labels */
    axesLayout: AxesLayout
}

export type TermdbAggregateMatrixResponse = ValidAggMatrixResponse | ErrorResponse