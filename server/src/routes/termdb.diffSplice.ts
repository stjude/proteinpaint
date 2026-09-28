import type { RoutePayload, RouteApi } from '#types'
import { init } from '../../routes/termdb.diffSplice.ts'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'DiffSpliceRequest' },
	response: { typeId: 'DiffSpliceResponse' }
}
export const api: RouteApi = {
	endpoint: 'termdb/diffSplice',
	methods: { get: payload, post: payload }
}
