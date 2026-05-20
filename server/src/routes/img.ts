import type { RoutePayload } from '#types'

export const imgPayload: RoutePayload = {
	request: { typeId: 'imgRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'imgResponse' }
}
