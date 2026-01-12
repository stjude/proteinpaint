import type { Filter } from '../filter.ts'
import type { RoutePayload } from './routeApi.js'

/** */
export type ChatRequest = {
	genome: string
	dslabel: string
	filter?: Filter
	/** user prompt */
	prompt: string
	__protected__?: any
}

type HtmlResponse = {
	type: 'html'
	/** for display only */
	html: string
}
export type PlotResponse = {
	type: 'plot'
	/** plot state. Currently only supports summary chart, will add other chart types later */
	plot: object
	/** Specifies what action to take e.g. Summary plot or no action. Will add more chart types later */
}

export type ChatResponse = HtmlResponse | PlotResponse

export const ChatPayload: RoutePayload = {
	request: {
		typeId: 'ChatRequest'
	},
	response: {
		typeId: 'ChatResponse'
	}
	//examples: []
}

export type SummaryType = {
	action: string
	summaryterms: SummaryTerm[]
	simpleFilter?: FilterTerm[]
}

export type SummaryTerm = {
	term: string
}

export type FilterTerm = {
	FilterTerm: CategoricalFilterTerm | NumericFilterTerm
}

export type CategoricalFilterTerm = {
	term: string
	category: string
}

export type NumericFilterTerm = {
	term: string
	greaterThan: number
	lessThan: number
}
