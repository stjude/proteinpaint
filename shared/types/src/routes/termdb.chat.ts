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
	plot: SummaryResponse
	/** Specifies what action to take e.g. Summary plot or no action. Will add more chart types later */
	action: 'summary' | 'none'
}

type SummaryResponse = {
	chartType: 'summary'
	term: TermType | GeneExpression
	term2?: TermType | GeneExpression
}

type TermType = {
	/** Term id */
	id: string
}

type GeneExpression = {
	/** Gene name */
	gene: string
	type: 'geneExpression'
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
