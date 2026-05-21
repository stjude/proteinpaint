import type { RouteApi, RoutePayload } from '#types'
import { init } from '../../routes/termdb.singleCellPlots.js'

const payload: RoutePayload = {
	init,
	request: { typeId: 'TermdbSingleCellPlotsRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermdbSingleCellPlotsResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/singleCellPlots',
	methods: {
		get: payload,
		post: payload
	}
}
