import type { RoutePayload } from './routeApi.ts'

export type DeleteWSIAnnotationRequest = {
	genome: string
	dslabel: string
	projectId: number
	annotation: any
	wsimage: string
}

export type DeleteWSIAnnotationResponse = {
	status: string
	error?: string
}

export const deleteWSIAnnotationPayload: RoutePayload = {
	request: {
		typeId: 'DeleteWSIAnnotationRequest'
	},
	response: {
		typeId: 'DeleteWSIAnnotationResponse'
	}
}
