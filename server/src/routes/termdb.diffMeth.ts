import type { RoutePayload } from '#types'

export const diffMethPayload: RoutePayload = {
	request: { typeId: 'DiffMethRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'DiffMethResponse' }
}
