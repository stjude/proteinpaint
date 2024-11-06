import type { RoutePayload } from './routeApi.js'
//import GdcFilter0 from './filter.gdc'
import type { Term } from '../terms/term.ts'
import type { Filter } from '../filter.ts'

export type TermdbTopTermsByTypeRequest = {
	/** Ref genome */
	genome: string
	/** Ds label */
	dslabel: string
	/* Term type */
	type: string
	/** pp filter */
	filter?: Filter
	/** JSON, optional GDC cohort filter to restrict cases */
	filter0?: any //GdcFilter0
}

export type TermdbTopTermsByTypeResponse = {
	/** Array of gene names TODO may change element to objs */
	terms: Term[]
}

export const termdbTopTermsByTypePayload: RoutePayload = {
	request: {
		typeId: 'TermdbTopTermsByTypeRequest'
	},
	response: {
		typeId: 'TermdbTopTermsByTypeResponse'
	},
	// examples: []
}
