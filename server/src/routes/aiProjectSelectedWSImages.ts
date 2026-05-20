import type { RouteApi } from '#types'
import { aiProjectSelectedWSImagesResponsePayload } from '#types/checkers'
import { init } from '../../routes/aiProjectSelectedWSImages.ts'

export const api: RouteApi = {
	endpoint: 'aiProjectSelectedWSImages',
	methods: {
		get: {
			...aiProjectSelectedWSImagesResponsePayload,
			init
		},
		post: {
			...aiProjectSelectedWSImagesResponsePayload,
			init
		}
	}
}
