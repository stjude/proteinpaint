import type { RoutePayload } from '#types'

export const termdbCohortsPayload: RoutePayload = {
	request: { typeId: 'TermdbCohortsRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermdbCohortsResponse' }
}
