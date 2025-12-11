import type { Filter } from '../filter.ts'
import type { RoutePayload } from './routeApi.js'

/** */
export type ChatRequest = {
	genome: string
	dslabel: string
	filter?: Filter
	/** user prompt */
	prompt: string
	__protected__: any
}

type HtmlResponse = {
	type: 'html'
	/** for display only */
	html: string
}
type PlotResponse = {
	type: 'plot'
	/** plot state */
	plot: object
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
