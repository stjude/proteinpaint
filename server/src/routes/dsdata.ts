import type { RoutePayload, RouteApi } from '#types'
import { init } from '../../routes/dsdata.ts'

const payload: RoutePayload = {
	init,
	request: { typeId: 'DsDataRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'DsDataResponse' }
}

export const api: RouteApi = {
	// route endpoint
	// - no need for trailing slash
	// - should be a noun (method is based on HTTP GET, POST, etc)
	// - don't add 'Data' as response is assumed to be data
	endpoint: 'dsdata',
	methods: {
		get: payload,
		post: payload
	}
}
