import type { RoutePayload } from './routeApi.ts'

export type SaveWSIAnnotationRequest = {
	coordinates: [number, number]
	class: number
}

export type SaveWSIAnnotationResponse = {
	status: 'ok' | 'error'
	error?: string
}

export const saveWSIAnnotationPayload: RoutePayload = {
	request: {
		typeId: 'SaveWSIAnnotationRequest'
	},
	response: {
		typeId: 'SaveWSIAnnotationResponse'
	}
}
