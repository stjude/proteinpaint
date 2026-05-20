import type { RoutePayload } from '#types'

export const pdomainPayload: RoutePayload = {
	request: { typeId: 'PdomainRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'PdomainResponse' }
}
