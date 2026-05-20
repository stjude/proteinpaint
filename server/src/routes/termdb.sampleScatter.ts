import type { RouteApi } from '#types'
import { termdbSampleScatterPayload } from '#types/checkers'
import { init } from '../../routes/termdb.sampleScatter.ts'

export const api: RouteApi = {
	endpoint: 'termdb/sampleScatter',
	methods: {
		get: {
			...termdbSampleScatterPayload,
			init
		},
		post: {
			...termdbSampleScatterPayload,
			init
		}
	}
}
