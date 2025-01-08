import type { RoutePayload } from './routeApi.js'

export type WSImagesRequest = {
	genome: string
	dslabel: string
	sampleId: string
	wsimage: string
}

export type WSImagesResponse = {
	// TileServer image session id
	wsiSessionId?: string
	// Identifier for the image instance displayed in the browser
	// In case the same image is displayed in multiple browser windows, a new id is generated
	browserImageInstanceId?: string
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
