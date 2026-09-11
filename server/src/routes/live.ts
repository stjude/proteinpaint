import type { LiveResponse, RouteApi } from '#types'

// Lightweight liveness check for frequent polling, as an alternative to the
// full /healthcheck route which computes and returns genome/dataset build info.
export const api: RouteApi = {
	endpoint: 'live',
	methods: {
		get: {
			init,
			request: { typeId: 'LiveRequest' },
			response: { typeId: 'LiveResponse' }
		}
	}
}

function init(opts: any = {}) {
	return async (req, res): Promise<void> => {
		res.send({ status: 'ok', detailsAt: `${opts.basepath || ''}/status` } satisfies LiveResponse)
	}
}
