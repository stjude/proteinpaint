import type { RoutePayload } from '#types'

export const wsiSamplesPayload: RoutePayload = {
	request: { typeId: 'WSISamplesRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'WSISamplesResponse' }
}
