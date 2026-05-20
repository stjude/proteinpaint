import type { RouteApi } from '#types'
import { termdbSingleCellSamplesPayload } from '#types/checkers'
import { init } from '../../routes/termdb.singlecellSamples.ts'

export const api: RouteApi = {
	endpoint: 'termdb/singlecellSamples',
	methods: {
		get: {
			...termdbSingleCellSamplesPayload,
			init
		},
		post: {
			...termdbSingleCellSamplesPayload,
			init
		}
	}
}
