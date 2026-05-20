import type { RouteApi } from '#types'
import { termdbTopVariablyExpressedGenesPayload } from '#types/checkers'
import { init } from '../../routes/termdb.topVariablyExpressedGenes.ts'

export const api: RouteApi = {
	endpoint: 'termdb/topVariablyExpressedGenes',
	methods: {
		get: {
			...termdbTopVariablyExpressedGenesPayload,
			init
		},
		post: {
			...termdbTopVariablyExpressedGenesPayload,
			init
		}
	}
}
