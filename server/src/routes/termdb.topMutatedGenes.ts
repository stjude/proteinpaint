import type { RouteApi } from '#types'
import { topMutatedGenePayload } from '#types/checkers'
import { init } from '../../routes/termdb.topMutatedGenes.ts'

export const api: RouteApi = {
	endpoint: 'termdb/topMutatedGenes',
	methods: {
		get: {
			init,
			...topMutatedGenePayload
		},
		post: {
			init,
			...topMutatedGenePayload
		}
	}
}
