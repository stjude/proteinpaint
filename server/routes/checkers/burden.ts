import type { RoutePayload } from '#types'

export const burdenPayload: RoutePayload = {
	request: { typeId: 'BurdenRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'BurdenResponse' }
}
