import type { RoutePayload } from '#types'

export const alphaGenomeTypesPayload: RoutePayload = {
	request: { typeId: 'alphaGenomeTypesRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'alphaGenomeTypesResponse' }
}
