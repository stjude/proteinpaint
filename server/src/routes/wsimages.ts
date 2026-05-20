import type { RouteApi } from '#types'
import { wsImagesPayload } from '#types/checkers'
import { init } from '../../routes/wsimages.ts'

export const api: RouteApi = {
	endpoint: 'wsimages',
	methods: {
		get: {
			...wsImagesPayload,
			init
		},
		post: {
			...wsImagesPayload,
			init
		}
	}
}
