import type { RoutePayload } from '#types'

export const isoformlstPayload: RoutePayload = {
	request: { typeId: 'IsoformLstRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'IsoformLstResponse' }
}
