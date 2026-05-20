import type { RoutePayload, RouteApi } from '#types'
import { init } from '../../routes/termdb.geneRanking.ts'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'GeneRankingRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'GeneRankingResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/geneRanking',
	methods: {
		get: payload,
		post: payload
	}
}
