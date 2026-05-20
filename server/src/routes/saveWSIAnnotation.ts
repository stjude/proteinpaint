import type { RoutePayload, RouteApi } from '#types'
import { init } from '../../routes/saveWSIAnnotation.ts'

const payload: RoutePayload = {
	init,
	request: { typeId: 'SaveWSIAnnotationRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'SaveWSIAnnotationResponse' }
}

export const api: RouteApi = {
	endpoint: 'saveWSIAnnotation',
	methods: {
		post: payload
	}
}
