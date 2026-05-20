import type { RoutePayload } from '#types'

export const ProfileFormScoresPayload: RoutePayload = {
	request: { typeId: 'ProfileFormScoresRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'ProfileFormScoresResponse' }
}
