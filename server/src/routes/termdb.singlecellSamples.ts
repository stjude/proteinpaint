import type { RoutePayload } from '#types'

export const termdbSingleCellSamplesPayload: RoutePayload = {
	request: { typeId: 'TermdbSingleCellSamplesRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermdbSingleCellSamplesResponse' }
}
