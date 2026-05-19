import type { RoutePayload } from '#types'

export const hicGenomePayload: RoutePayload = {
	request: { typeId: 'HicGenomeRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'HicGenomeResponse' }
}
