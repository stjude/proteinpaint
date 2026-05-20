import type { RoutePayload } from '#types'

export const ntseqPayload: RoutePayload = {
	request: { typeId: 'NtseqRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'NtseqResponse' }
}
