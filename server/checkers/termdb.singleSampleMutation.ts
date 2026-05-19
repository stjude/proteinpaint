import type { RoutePayload } from '#types'

export const termdbSingleSampleMutationPayload: RoutePayload = {
	request: { typeId: 'TermdbSingleSampleMutationRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermdbSingleSampleMutationResponse' }
}
