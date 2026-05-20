import type { RoutePayload } from '#types'

export const hicdataPayload: RoutePayload = {
	request: { typeId: 'HicdataRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'HicdataResponse' }
}
