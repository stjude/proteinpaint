import type { RoutePayload } from '#types'

export const termsByIdsPayload: RoutePayload = {
	request: { typeId: 'TermsByIdsRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermsByIdsResponse' }
}
