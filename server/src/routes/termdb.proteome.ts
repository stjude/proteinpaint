import type { RouteApi } from '#types'
import { termdbProteomePayload } from '#types/checkers'
import { init } from '../../routes/termdb.proteome.ts'

export const api: RouteApi = {
	endpoint: 'termdb/proteome',
	methods: {
		get: {
			...termdbProteomePayload,
			init
		},
		post: {
			...termdbProteomePayload,
			init
		}
	}
}
