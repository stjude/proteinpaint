import type { RoutePayload, RouteApi } from '#types'
import { init } from '../../routes/deleteWSITileSelection.ts'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'DeleteWSITileSelectionRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'DeleteWSITileSelectionResponse' }
}

export const api: RouteApi = {
	endpoint: `deleteWSITileSelection`, // TODO: rename to simply 'wsiTileSelection', method is based on HTTP method
	methods: {
		delete: payload
	}
}
