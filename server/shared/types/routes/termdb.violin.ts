import { Filter } from '../filter.ts'
import { TermWrapper } from '../terms/tw.ts'

export type getViolinRequest = BaseRequest & (TermRequest | SinglecellGeneExpRequest)

type BaseRequest = {
	genome: string
	dslabel: string
	embedder: string
	/** A number representing the device's pixel ratio, which may be used for rendering quality adjustments */
	devicePixelRatio: number
	filter: Filter
	/** A number representing the width of the SVG (Scalable Vector Graphics) box, used for rendering the chart */
	svgw: number
	/** A string with two possible values: 'horizontal' or 'vertical', indicating the orientation of the chart, either horizontal or vertical */
	orientation: 'horizontal' | 'vertical'
	/** A string representing the type of symbol used on the plot, which can be either 'circles' or 'rugs' */
	datasymbol: string
	/** A number representing the radius of the data symbols rendered on the plot */
	radius: number
	/** A number representing the width of the stroke used to generate the data symbols (data symbols are rendered on the server side) */
	strokeWidth: number
	/** A number representing the dimension perpendicular to the violin spread (the height of the axis) */
	axisHeight: number
	/** A number representing the right margin of the chart or plot */
	rightMargin: number
	/** A string representing a unit of measurement (e.g., 'log' for log scale) */
	unit: string
	/** ? */
	isKDE: boolean
}

// requesting violin by terms describing samples from a cohort
type TermRequest = {
	/** the tw of the numerical term to supply continuous values for computing violins, must have q.mode=continuous */
	term: TermWrapper
	/** the tw of a separate term to divide samples to groups and generate separate violins, must have q.mode=discrete/binary */
	divdeTw?: TermWrapper
}

// requesting violin by gene expression in a single cell experiment. this data cannot be expressed as a term, thus the exception
type SinglecellGeneExpRequest = {
	/** presence of this property allows backend code to tell this query is about singlecell data */
	singlecellGeneExpression: {
		/** sample name for which the data is requested for */
		sample: string
		/** name of a single gene for which data is requested for */
		gene: string
		/** optional cell category to divide gene exp values to groups, usually sc file column? */
		cellCategory?: string
	}
}

interface binsEntries {
	x0: number
	x1: number
	density: number
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

type plot = {
	label: string
	plotValueCount: number
	src: string
	bins: binsEntries[]
	densityMax: number
	biggestBin: number
	summaryStats: {
		values: valuesEntries[]
	}
}

export type getViolinResponse = {
	min: number
	max: number
	plots: plot[]
	pvalues?: pvalueEntries[][]
	uncomputableValueObj: any
}
