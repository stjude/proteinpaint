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
	term: string
	term2?: string
	simpleFilter: FilterTerm[]
	html?: string
}

export type FilterTerm = CategoricalFilterTerm | NumericFilterTerm

export type CategoricalFilterTerm = {
	term: string
	category: string
}

export type NumericFilterTerm = {
	term: string
	start?: number
	stop?: number
}

export type DbRows = {
	name: string
	description: string
	term_type: string
	values: DbValue[]
}

export type DbValue = {
	key: string
	value: string
}

export type ValidTerm = {
	/** Type for storing validated term and error message */
	validated_term: string
	invalid_html: string
}
