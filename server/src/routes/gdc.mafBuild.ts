import type { RoutePayload } from '#types'

export const GdcMafPayload: RoutePayload = {
	request: { typeId: 'GdcMafBuildRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'GdcMafBuildResponse' }
}
