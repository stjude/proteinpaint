import type { RoutePayload } from '#types'

export const diffExpPayload: RoutePayload = {
	request: { typeId: 'DERequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'DEResponse' }
}
