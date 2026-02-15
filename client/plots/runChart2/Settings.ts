export type RunChart2Settings = {
	aggregation: 'median'
	/** When true (frequency mode only), Y axis shows cumulative count over time. */
	showCumulativeFrequency?: boolean
	svgw: number
	svgh: number
	color: string
	opacity: number
	minXScale: null | number
	maxXScale: null | number
	minYScale: null | number
	maxYScale: null | number
}
