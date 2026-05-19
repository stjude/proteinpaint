import type { RoutePayload } from '#types'

export const datasetPayload: RoutePayload = {
	request: { typeId: 'DatasetRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'DatasetResponse' }
}
