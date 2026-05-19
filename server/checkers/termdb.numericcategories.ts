import type { RoutePayload } from '#types'

export const numericCategoriesPayload: RoutePayload = {
	request: { typeId: 'NumericCategoriesRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'NumericCategoriesResponse' }
}
