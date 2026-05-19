import type { RoutePayload } from '#types'

export const ProfileScoresPayload: RoutePayload = {
	request: { typeId: 'ProfileScoresRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'ProfileScoresResponse' }
}
