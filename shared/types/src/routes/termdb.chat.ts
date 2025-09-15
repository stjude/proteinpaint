import type { Filter } from '../filter.ts'
import type { RoutePayload } from './routeApi.js'

/** */
export type ChatRequest = {
	genome: string
	dslabel: string
	filter?: Filter
	filter0?: any // gdc
	/** user prompt */
	prompt: string
	__protected__: any
}

export type numeric_filter = {
	lower: number
	upper: number
}

export type categorical_filter = {
	name: string
}

export type filter_variable = {
	name: string
	variable_type: 'float' | 'categories'
	cutoff: numeric_filter | categorical_filter
}

export type summary = {
	group_categories: string
	overlay?: string
	divide_by?: string
	filter?: filter_variable
}

export type plot = {
	/** Different chart types currently supported by the AI chatbot */
	chartType: summary | 'survival' | 'hierarchial' | 'snv_indel' | 'cnv' | 'variant_calling' | 'none' | 'dge'
}

export type ChatResponse = {
	type: 'html' | 'plot'
	/** when type=html, this value is set meaning server returns a chat response */
	html?: string
	/** when type=plot. value is json */
	plot?: any
}

export const ChatPayload: RoutePayload = {
	request: {
		typeId: 'ChatRequest'
	},
	response: {
		typeId: 'ChatResponse'
	}
	//examples: []
}
