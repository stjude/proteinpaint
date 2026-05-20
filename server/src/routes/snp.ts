import type { RouteApi } from '#types'
import { snpPayload } from '#types/checkers'
import { init } from '../../routes/snp.ts'

export const api: RouteApi = {
	// route endpoint
	// - no need for trailing slash
	// - should be a noun (method is based on HTTP GET, POST, etc)
	// - don't add 'Data' as response is assumed to be data
	endpoint: 'snp',
	methods: {
		get: {
			...snpPayload,
			init
		},
		post: {
			...snpPayload,
			init
		}
	}
}
