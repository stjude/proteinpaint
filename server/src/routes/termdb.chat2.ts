import type { RoutePayload } from '#types'

export const ChatPayload: RoutePayload = {
	request: { typeId: 'ChatRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'ChatResponse' }
}
