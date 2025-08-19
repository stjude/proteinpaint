import type { RoutePayload } from './routeApi.ts'

export type SaveWSIAnnotationRequest = {
	coordinates: [number, number]
	class: number
	projectId: number
	wsimageId: number
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
