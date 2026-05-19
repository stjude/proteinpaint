import type { RoutePayload } from '#types'

export const deleteWSITileSelectionPayload: RoutePayload = {
	request: { typeId: 'DeleteWSITileSelectionRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'DeleteWSITileSelectionResponse' }
}
