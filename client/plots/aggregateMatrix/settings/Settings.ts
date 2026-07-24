export type AggregateMatrixSettings = {
    /** Start color for the color gradient */
    startColor: string
    /** Stop color for the color gradient */
    stopColor: string
    /** Aggregation method to determine the color gradient. */
    gradientMethod: string
    /** Aggregation method to determine the dot sizes. */
    sizeMethod: string
    /** Min size of the dots in pixels */
    minDotSize: number
     /** Max size of the dots in pixels */
    maxDotSize: number
}