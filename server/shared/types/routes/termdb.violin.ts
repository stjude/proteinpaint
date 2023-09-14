import { Filter } from '../filter'

export type getViolinRequest = {
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
interface binsEntries {
	x0: number
	x1: number
	binValueCount: number
}
interface valuesEntries {
	id: string
	label: string
	value: number
}

interface pvalueEntries {
	value?: string
	html?: string
}

export type getViolinResponse = {
	min: number
	max: number
	plots: [
		{
			label: string
			plotValueCount: number
			src: string
			bins: binsEntries[]
			biggestBin: number
			summaryStats: {
				values: valuesEntries[]
			}
		}
	]
	pvalues?: pvalueEntries[][]
	plotThickness: number
	uncomputableValueObj: any
}
