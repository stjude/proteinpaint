import type { RouteApi } from '#types'
import { runGRIN2Payload } from '#types/checkers'
import { init } from '../../routes/gdc.grin2.run.ts'

export const api: RouteApi = {
	endpoint: 'gdc/runGRIN2',
	methods: {
		get: {
			...runGRIN2Payload,
			init
		},
		post: {
			...runGRIN2Payload,
			init
		}
	}
}
