import type { RoutePayload } from './routeApi.js'
import type { Filter } from '../filter.ts'
import type { ErrorResponse } from './errorResponse.ts'

export type ViolinRequest = {
	genome: string
	dslabel: string
	embedder: string
	/** main tw to fetch numeric data to show in violin */
	tw: any
	/** ?? TODO: Needs description */
	currentGeneNames: string[]
	/** optional tw to divide tw data into multiple violins and show under one axis */
	divideTw?: any
	/** A number representing the device's pixel ratio, which may be used for rendering quality adjustments */
	devicePixelRatio: number
	/** optional mass filter */
	filter?: Filter
	/** optional read-only invisible filter TODO GdcFilter0 */
	filter0?: any
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
	/** ?? TODO: Needs description */
	scale: any
	/** ?? TODO: Needs description */
	isKDE: boolean
	/** ?? TODO: Needs description */
	ticks: any
}

/** ?? TODO: Needs description */
interface BinsEntries {
	x0: number
	x1: number
	density: number
}

/** ?? TODO: Needs description */
interface ValuesEntries {
	id: string
	label: string
	value: number
}

/** Computed in wilcoxon to show in table */
interface PValueEntries {
	value?: string
	html?: string
}

/** ?? TODO: Needs description */
type ViolinDensity = {
	bins: BinsEntries[]
	densityMax: number
	densityMin: number
}

export type ViolinPlotEntry = {
	/** ?? TODO: Needs description
	 * Doesn't appear to be used on the client */
	biggestBin: number
	/** Color to render */
	color: string
	density: ViolinDensity
	divideTwBins: any
	/** Text for label */
	label: string
	/** Number of samples/cases/patients/etc. */
	plotValueCount: number
	/** Cooresponds to the tw.$id */
	seriesId: string
	/** Plot image to display */
	src: string
	summaryStats: {
		/** Descriptive stats (i.e. min, max, sd, etc.) */
		values: ValuesEntries[]
	}
	uncomputableValueObj: { [index: string]: number } | null
}

export type ViolinResponse = ValidResponse | ErrorResponse

type ValidResponse = {
	/** Absolute min value for all plots */
	min: number
	/** Absolute max value for all plots */
	max: number
	plots: ViolinPlotEntry[]
	pvalues?: PValueEntries[][]
	uncomputableValueObj: { [index: string]: number }[] | null
}

export const violinPayload: RoutePayload = {
	request: {
		typeId: 'ViolinRequest'
	},
	response: {
		typeId: 'ViolinResponse'
	},
	examples: [
		{
			request: {
				body: {
					genome: 'hg38-test',
					dslabel: 'TermdbTest',
					embedder: 'localhost',
					devicePixelRatio: 2.200000047683716,
					maxThickness: 150,
					screenThickness: 1218,
					filter: {
						type: 'tvslst',
						in: true,
						join: '',
						lst: [
							{
								tag: 'cohortFilter',
								type: 'tvs',
								tvs: { term: { id: 'subcohort', type: 'categorical' }, values: [{ key: 'ABC', label: 'ABC' }] }
							}
						]
					},
					svgw: 227.27272234672367,
					orientation: 'horizontal',
					datasymbol: 'bean',
					radius: 5,
					strokeWidth: 0.2,
					axisHeight: 60,
					rightMargin: 50,
					unit: 'abs',
					termid: 'agedx'
				}
			},
			response: {
				header: { status: 200 }
			}
		}
	]
}
