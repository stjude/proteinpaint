import type { RouteApi, WSImagesResponse } from '#types'
import { wsiSamplesPayload } from '@sjcrh/proteinpaint-types/routes/wsisamples.js'

const routePath = 'wsisamples'
export const api: RouteApi = {
	endpoint: `${routePath}`,
	methods: {
		get: {
			...wsiSamplesPayload,
			init
		},
		post: {
			...wsiSamplesPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const payload: WSImagesResponse = {
				status: 'ok',
				wsiSessionId: 'sessionId',
				slide_dimensions: [0, 0]
			}

			res.status(200).json(payload)
		} catch (e: any) {
			console.warn(e)
			res.status(500).send({
				status: 'error',
				error: e.message || e
			})
		}
	}
}
