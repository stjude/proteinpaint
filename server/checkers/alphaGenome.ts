import type { RoutePayload } from '#types'

export const alphaGenomePayload: RoutePayload = {
	request: { typeId: 'alphaGenomeRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'alphaGenomeResponse' }
}
