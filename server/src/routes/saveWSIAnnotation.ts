import type { RouteApi } from '#types'
import { saveWSIAnnotationPayload } from '#types/checkers'
import { init } from '../../routes/saveWSIAnnotation.ts'

export const api: RouteApi = {
	endpoint: `${routePath}`,
	methods: {
		post: {
			...saveWSIAnnotationPayload,
			init
		}
	}
}
