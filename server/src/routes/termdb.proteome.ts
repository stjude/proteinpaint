import type { RoutePayload, RouteApi } from '#types'
import { init } from '../../routes/termdb.proteome.ts'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'TermdbProteomeRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermdbProteomeResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/proteome',
	methods: {
		get: payload
	}
}
