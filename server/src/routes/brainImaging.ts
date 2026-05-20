import type { RouteApi } from '#types'
import { brainImagingPayload } from '#types/checkers'
import { init } from '../../routes/brainImaging.ts'

export const api: RouteApi = {
	endpoint: 'brainImaging',
	methods: {
		get: {
			...brainImagingPayload,
			init
		},
		post: {
			...brainImagingPayload,
			init
		}
	}
}
