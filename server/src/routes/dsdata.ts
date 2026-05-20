import type { RoutePayload } from '#types'

export const dsDataPayload: RoutePayload = {
	request: { typeId: 'DsDataRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'DsDataResponse' }
}
