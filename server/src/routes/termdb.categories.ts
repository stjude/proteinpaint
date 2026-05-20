import type { RoutePayload } from '#types'

export const termdbCategoriesPayload: RoutePayload = {
	request: { typeId: 'CategoriesRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'CategoriesResponse' }
}
