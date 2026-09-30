import type { RouteApi } from '#types'
import * as massSession from '#src/massSession.js'

export const api: RouteApi = {
	// saves, gets, or deletes a mass app state as a server-side session file
	endpoint: 'massSession',
	methods: {
		get: {
			init: () => massSession.get,
			request: { typeId: 'MassSessionGetRequest' /*, checkers: TODO write validator */ },
			response: { typeId: 'MassSessionGetResponse' }
		},
		post: {
			init: () => massSession.save,
			request: { typeId: 'MassSessionSaveRequest' },
			response: { typeId: 'MassSessionSaveResponse' }
		},
		delete: {
			init: () => massSession._delete,
			request: { typeId: 'MassSessionDeleteRequest' },
			response: { typeId: 'MassSessionDeleteResponse' }
		}
	}
}
