import type { RoutePayload } from '#types'

export const dapVolcanoPayload: RoutePayload = {
	request: { typeId: 'DapVolcanoRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'DapVolcanoResponse' }
}
