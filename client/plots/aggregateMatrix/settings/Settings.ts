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
    /** Min value for the dot size input range
     * Used in controls and the legend to determine the min dot size. */
    dotInputMin: number
    /** Max value for the dot size input range.
     * Used in controls and the legend to determine the min dot size. */
    dotInputMax: number
}