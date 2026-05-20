import type { RouteApi } from '#types'
import { dsDataPayload } from '#types/checkers'
import { init } from '../../routes/dsdata.ts'

export const api: RouteApi = {
	// route endpoint
	// - no need for trailing slash
	// - should be a noun (method is based on HTTP GET, POST, etc)
	// - don't add 'Data' as response is assumed to be data
	endpoint: 'dsdata',
	methods: {
		get: {
			...dsDataPayload,
			init
		},
		post: {
			...dsDataPayload,
			init
		}
	}
}
