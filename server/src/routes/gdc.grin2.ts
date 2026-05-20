import type { RoutePayload } from '#types'

export const gdcGRIN2listPayload: RoutePayload = {
	request: { typeId: 'GdcGRIN2listRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'GdcGRIN2listResponse' }
}
export const runGRIN2Payload: RoutePayload = {
	request: { typeId: 'RunGRIN2Request' /*, checkers: TODO write validator */ },
	response: { typeId: 'RunGRIN2Response' }
}
