import { Filter } from '../filter'

/**
 * @param axisHeight - A number representing the dimension perpendicular to the violin spread (the height of the axis).
 * @param maxThickness - A number representing the maximum thickness of each violin plot rendered.
 * @param svgw - A number representing the width of the SVG (Scalable Vector Graphics) box, used for rendering the chart.
 * @param orientation - A string with two possible values: 'horizontal' or 'vertical', indicating the orientation of the chart, either horizontal or vertical.
 * @param datasymbol - A string representing the type of symbol used on the plot, which can be either 'circles' or 'rugs'.
 * @param radius - A number representing the radius of the data symbols rendered on the plot.
 * @param strokeWidth - A number representing the width of the stroke used to generate the data symbols (data symbols are rendered on the server side).
 * @param rightMargin - A number representing the right margin of the chart or plot.
 * @param unit - A string representing a unit of measurement (e.g., 'log' for log scale).
 * @param filter - An object of type Filter, that defines some filter-related properties
 * @param plotThickness - A number representing the thickness of the plot.
 * @param termid - A string representing a term identifier, related to the term from the data being visualized.
 */

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
