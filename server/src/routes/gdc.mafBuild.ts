import type { RouteApi } from '#types'
import { gdcMafPayload } from '#types/checkers'
import { init } from '../../routes/gdc.mafBuild.ts'

export const api: RouteApi = {
	endpoint: 'gdc/mafBuild',
	methods: {
		get: {
			init,
			...gdcMafPayload
		},
		post: {
			init,
			...gdcMafPayload
		}
	}
}
