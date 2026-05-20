import type { RoutePayload } from '#types'

export const tilePayload: RoutePayload = {
	request: { typeId: 'TileRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TileResponse' }
}
