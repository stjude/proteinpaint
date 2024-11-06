import type { RoutePayload } from './routeApi.js'

export type WSImagesRequest = {
	genome: string
	dslabel: string
	sampleId: string
	wsimage: string
}

export type WSImagesResponse = {
	sessionId?: string
	slide_dimensions: number[]
	status: string
}

export const wsImagesPayload: RoutePayload = {
	request: {
		typeId: 'WSImagesRequest'
	},
	response: {
		typeId: 'WSImagesResponse'
	}
	// examples: []
}
