import type { RoutePayload } from './routeApi.js'

export type GeneRankingRequest = {
	genome: string
	dslabel: string
	/** when omitted, server returns the list of available keys */
	key?: string
}

export type GeneRankingResponse = {
	/** available ranking keys when no key was supplied */
	keys?: string[]
	/** column labels in file order */
	columns?: string[]
	/** rows of cell values; numeric where possible, string otherwise */
	rows?: (string | number | null)[][]
	error?: string
}

export const geneRankingPayload: RoutePayload = {
	request: {
		typeId: 'GeneRankingRequest'
	},
	response: {
		typeId: 'GeneRankingResponse'
	}
}
