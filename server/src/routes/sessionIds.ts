import type { RouteApi } from '#types'
import { getSessionIdsByCred } from '#src/massSession.js'

export const api: RouteApi = {
	// lists the mass session ids that were saved under the requester's credentials
	endpoint: 'sessionIds',
	methods: {
		get: {
			init: () => getSessionIdsByCred,
			request: { typeId: 'SessionIdsRequest' /*, checkers: TODO write validator */ },
			response: { typeId: 'SessionIdsResponse' }
		}
	}
}
