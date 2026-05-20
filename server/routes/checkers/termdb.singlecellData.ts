import type { RoutePayload } from '#types'

export const termdbSingleCellDataPayload: RoutePayload = {
	request: { typeId: 'TermdbSingleCellDataRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermdbSingleCellDataResponse' }
}
