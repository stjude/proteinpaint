import type { RoutePayload } from '#types'

export const descrStatsPayload: RoutePayload = {
	request: { typeId: 'DescrStatsRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'DescrStatsResponse' }
}
