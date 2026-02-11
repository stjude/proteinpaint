export type RunChart2Settings = {
	aggregation: 'mean' | 'median' | string
	svgw: number
	svgh: number
	color: string
	opacity: number
	minXScale: null | number
	maxXScale: null | number
	minYScale: null | number
	maxYScale: null | number
}
