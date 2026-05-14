import type { RoutePayload } from './routeApi.js'
import type { ErrorResponse } from './errorResponse.ts'

export type TermdbSingleCellPlotsRequest = {
	/** Genome id */
	genome: string
}

export type TermdbSingleCellPlotsResponse = ErrorResponse | ValidSingleCellResponse

export type ValidSingleCellResponse = {
	/** List of single cell plot types available */
	plotTypes: string[]
}

export const termdbSingleCellPlotsPayload: RoutePayload = {
	request: {
		typeId: 'TermdbSingleCellPlotsRequest'
	},
	response: {
		typeId: 'TermdbSingleCellPlotsResponse'
	}
	// examples: []
}
