import type { RoutePayload, RouteApi } from '#types'
import { init } from '../../routes/dataset.ts'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'DatasetRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'DatasetResponse' }
}

export const api: RouteApi = {
	endpoint: 'getDataset', // should rename to simply 'dataset', method is based on HTTP method
	methods: {
		get: payload,
		post: payload
	}
}
