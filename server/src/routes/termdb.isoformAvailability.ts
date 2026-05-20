import type { RoutePayload } from '#types'

export const TermdbIsoformAvailabilityPayload: RoutePayload = {
	request: { typeId: 'TermdbIsoformAvailabilityRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermdbIsoformAvailabilityResponse' }
}
