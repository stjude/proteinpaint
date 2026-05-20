import type { RoutePayload, RouteApi } from '#types'
import { init } from '../../routes/gdc.grin2.list.ts'

const payload: RoutePayload = {
	init,
	request: { typeId: 'GdcGRIN2listRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'GdcGRIN2listResponse' }
}

export const api: RouteApi = {
	endpoint: 'gdc/GRIN2list',
	methods: {
		get: payload,
		post: payload
	}
}
