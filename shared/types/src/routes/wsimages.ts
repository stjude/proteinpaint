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
	slide_dimensions: number[]
	status: string
	error?: string
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
