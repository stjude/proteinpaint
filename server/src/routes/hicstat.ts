import type { RoutePayload } from '#types'

export const hicstatPayload: RoutePayload = {
	request: { typeId: 'HicstatRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'HicstatResponse' }
}
