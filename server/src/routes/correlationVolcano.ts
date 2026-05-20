import type { RoutePayload, RouteApi } from '#types'
import { init } from '../../routes/correlationVolcano.ts'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'CorrelationVolcanoRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'CorrelationVolcanoResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/correlationVolcano',
	methods: {
		get: payload,
		post: payload
	}
}
