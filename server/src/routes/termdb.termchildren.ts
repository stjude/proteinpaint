import type { RoutePayload } from '#types'

export const termChildrenPayload: RoutePayload = {
	request: { typeId: 'TermChildrenRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermChildrenResponse' }
}
