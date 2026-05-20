import type { RoutePayload } from '#types'

export const percentilePayload: RoutePayload = {
	request: { typeId: 'PercentileRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'PercentileResponse' }
}
