import type { RouteApi } from '#types'
import { datasetPayload } from '#types/checkers'
import { init } from '../../routes/dataset.ts'

export const api: RouteApi = {
	endpoint: 'getDataset', // should rename to simply 'dataset', method is based on HTTP method
	methods: {
		get: {
			init,
			...datasetPayload
		},
		post: {
			init,
			...datasetPayload
		}
	}
}
