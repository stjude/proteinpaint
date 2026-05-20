import type { RoutePayload } from '#types'

export const runChartPayload: RoutePayload = {
	request: { typeId: 'RunChartRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'RunChartResponse' }
}
