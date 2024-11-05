import type { RoutePayload } from './routeApi.js'

export type TermdbCohortSummaryRequest = any
export type TermdbCohortSummaryResponse = any

export const termdbCohortSummaryPayload: RoutePayload = {
	request: {
		typeId: 'TermdbCohortSummaryRequest'
	},
	response: {
		typeId: 'TermdbCohortSummaryResponse'
	}
	// examples: []
}
