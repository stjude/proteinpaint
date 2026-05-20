import type { RouteApi } from '#types'
import { geneRankingPayload } from '#types/checkers'
import { init } from '../../routes/termdb.geneRanking.ts'

export const api: RouteApi = {
	endpoint: 'termdb/geneRanking',
	methods: {
		get: { ...geneRankingPayload, init },
		post: { ...geneRankingPayload, init }
	}
}
