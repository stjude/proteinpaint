import type { RoutePayload } from '#types'

export const termdbProteomePayload: RoutePayload = {
	request: { typeId: 'TermdbProteomeRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermdbProteomeResponse' }
}
