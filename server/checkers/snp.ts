import type { RoutePayload } from '#types'

export const snpPayload: RoutePayload = {
	request: { typeId: 'SnpRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'SnpResponse' }
}
