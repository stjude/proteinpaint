import type { RouteApi } from '#types'
import { gdcMafPayload } from '#types/checkers'
import { init } from '../../routes/gdc.maf.ts'

export const api: RouteApi = {
	endpoint: 'gdc/maf',
	methods: {
		get: {
			...gdcMafPayload,
			init
		},
		post: {
			...gdcMafPayload,
			init
		}
	}
}
