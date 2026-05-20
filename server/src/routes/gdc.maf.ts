import type { RoutePayload, RouteApi } from '#types'
import { init } from '../../routes/gdc.maf.ts'

const payload: RoutePayload = {
	init,
	request: { typeId: 'GdcMafRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'GdcMafResponse' }
}

export const api: RouteApi = {
	endpoint: 'gdc/maf',
	methods: {
		get: payload,
		post: payload
	}
}
