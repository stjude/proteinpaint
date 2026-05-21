import type { RoutePayload, RouteApi } from '#types'
import { init } from '../../routes/gdc.grin2.run.ts'

const payload: RoutePayload = {
	init,
	request: { typeId: 'RunGRIN2Request' /*, checkers: TODO write validator */ },
	response: { typeId: 'RunGRIN2Response' }
}

export const api: RouteApi = {
	endpoint: 'gdc/runGRIN2',
	methods: {
		get: payload,
		post: payload
	}
}
