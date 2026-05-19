import type { RoutePayload } from '#types'

export const TermdbDmrPayload: RoutePayload = {
	request: { typeId: 'TermdbDmrRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermdbDmrResponse' }
}
