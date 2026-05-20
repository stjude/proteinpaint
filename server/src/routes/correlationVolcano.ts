import type { RouteApi } from '#types'
import { CorrelationVolcanoPayload } from '#types/checkers'
import { init } from '../../routes/correlationVolcano.ts'

export const api: RouteApi = {
	endpoint: 'termdb/correlationVolcano',
	methods: {
		get: {
			...CorrelationVolcanoPayload,
			init
		},
		post: {
			...CorrelationVolcanoPayload,
			init
		}
	}
}
