import type { RoutePayload } from '#types'

export const rootTermPayload: RoutePayload = {
	request: { typeId: 'RootTermRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'RootTermResponse' }
}
