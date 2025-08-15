import type { RoutePayload } from './routeApi.js'

export type WSImagesRequest = {
	genome: string
	dslabel: string
	sampleId?: string
	wsimage?: string
	aiProjectId?: number
}

export type WSImagesResponse = {
	// TileServer image session id
	wsiSessionId?: string
	overlays?: Array<PredictionOverlay>
	slide_dimensions: number[]
	status: string
	error?: string
}

export type PredictionOverlay = {
	layerNumber: string
	predictionOverlayType: string
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
