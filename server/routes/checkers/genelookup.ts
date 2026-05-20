import type { RoutePayload } from '#types'

export const geneLookupPayload: RoutePayload = {
	request: { typeId: 'GeneLookupRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'GeneLookupResponse' }
}
