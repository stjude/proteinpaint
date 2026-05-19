import type { RoutePayload } from '#types'

export const gdcMafPayload: RoutePayload = {
	request: { typeId: 'GdcMafRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'GdcMafResponse' }
}
