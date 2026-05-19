import type { RoutePayload } from '#types'

export const termdbTopTermsByTypePayload: RoutePayload = {
	request: { typeId: 'TermdbTopTermsByTypeRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermdbTopTermsByTypeResponse' }
}
