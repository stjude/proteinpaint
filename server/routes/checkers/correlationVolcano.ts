import type { RoutePayload } from '#types'

export const CorrelationVolcanoPayload: RoutePayload = {
	request: { typeId: 'CorrelationVolcanoRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'CorrelationVolcanoResponse' }
}
