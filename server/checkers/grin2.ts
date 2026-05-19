import type { RoutePayload } from '#types'

export const GRIN2Payload: RoutePayload = {
	request: { typeId: 'GRIN2Request' /*, checkers: TODO write validator */ },
	response: { typeId: 'GRIN2Response' }
}
