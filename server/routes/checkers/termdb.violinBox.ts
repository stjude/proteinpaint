import type { RoutePayload } from '#types'

export const violinBoxPayload: RoutePayload = {
	request: { typeId: 'ViolinBoxRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'ViolinBoxResponse' }
}
