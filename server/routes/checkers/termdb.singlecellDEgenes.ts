import type { RoutePayload } from '#types'

export const termdbSingleCellDEgenesPayload: RoutePayload = {
	request: { typeId: 'TermdbSingleCellDEgenesRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermdbSingleCellDEgenesResponse' }
}
