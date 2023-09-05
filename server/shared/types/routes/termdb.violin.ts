import { Filter } from '../filter.ts'

export type getViolinDataRequest = {
	genome: string
	dslabel: string
	embedder: string
	devicePixelRatio: number
	maxThickness: number
	screenThickness: number
	filter: Filter
	svgw: number
	orientation: 'horizontal' | 'vertical'
	datasymbol: string
	radius: number
	strokeWidth: number
	axisHeight: number
	rightMargin: number
	unit: string
	plotThickness: number
	termid: string
}

export type getViolinDataResponse = {
	min: number
	max: number
	plots: any
	pvalues: number[]
	plotThickness: number
	uncomputableValueObj: any
}
