import type { RoutePayload } from '#types'

export const healthcheckPayload: RoutePayload = {
	request: { typeId: 'HealthCheckRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'HealthCheckResponse' }
}
