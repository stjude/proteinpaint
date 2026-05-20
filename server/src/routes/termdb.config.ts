import type { RouteApi, RoutePayload } from '#types'
import { init } from '../../routes/termdb.config.ts'

const payload: RoutePayload = {
	init,
	request: { typeId: 'any' },
	response: { typeId: 'any' }
}

export const api: RouteApi = {
	endpoint: 'termdb/config',
	methods: {
		get: payload
	}
}
