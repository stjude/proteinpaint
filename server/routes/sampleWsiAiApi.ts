import type { RouteApi } from '#types'
import { sampleWsiAiApiPayload } from '#types/checkers'

const routePath = 'sampleWsiAiApi'
export const api: RouteApi = {
	endpoint: `${routePath}`,
	methods: {
		get: {
			...sampleWsiAiApiPayload,
			init
		},
		post: {
			...sampleWsiAiApiPayload,
			init
		}
	}
}

function init() {
	return async (req, res): Promise<void> => {
		try {
			const request = req.query
			console.log('sample wsi api request:', request)
			res.status(200).send({ testKey: 'completed' })
		} catch (e: any) {
			console.warn(e)
			res.status(500).send({
				status: 'error',
				error: e.message || e
			})
		}
	}
}
