import { init } from './healthcheck.ts'
import type { RouteApi } from '#types'

// Alias of /healthcheck under a name that's easier to tell apart from the
// lightweight /health liveness check. Reuses the exact same handler so the
// two endpoints can never drift out of sync.
export const api: RouteApi = {
	endpoint: 'status',
	methods: {
		get: {
			init,
			request: { typeId: 'HealthCheckRequest' },
			response: { typeId: 'HealthCheckResponse' }
		}
	}
}
