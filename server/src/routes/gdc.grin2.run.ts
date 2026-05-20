import type { RoutePayload, RouteApi } from '#types'
import { init } from '../../routes/gdc.grin2.run.ts'

const payload: RoutePayload = {
	init,
	request: { typeId: 'GdcGRIN2runRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'GdcGRIN2runResponse' }
}

export const api: RouteApi = {
	endpoint: 'gdc/GRIN2list',
	methods: {
		get: payload,
		post: payload
	}
}
