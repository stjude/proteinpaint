import type { RoutePayload } from './routeApi.ts'

export type SaveWSIAnnotationRequest = {
	genome: string
	dslabel: string
	coordinates: [number, number]
	classId: number
	projectId: number
	wsimage: string
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
