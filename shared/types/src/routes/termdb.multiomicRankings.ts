import type { RoutePayload } from './routeApi.js'

export type MultiomicRankingsRequest = {
	genome: string
	dslabel: string
	/** when omitted, server returns the list of available keys */
	key?: string
}

export type MultiomicRankingsResponse = {
	/** available ranking keys when no key was supplied */
	keys?: string[]
	/** column labels in file order */
	columns?: string[]
	/** rows of cell values; numeric where possible, string otherwise */
	rows?: (string | number | null)[][]
	error?: string
}

export const multiomicRankingsPayload: RoutePayload = {
	request: {
		typeId: 'MultiomicRankingsRequest'
	},
	response: {
		typeId: 'MultiomicRankingsResponse'
	}
}
