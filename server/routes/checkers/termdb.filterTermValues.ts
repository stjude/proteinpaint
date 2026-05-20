import type { RoutePayload } from '#types'

export const FilterTermValuesPayload: RoutePayload = {
	request: { typeId: 'FilterTermValuesRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'FilterTermValuesResponse' }
}
