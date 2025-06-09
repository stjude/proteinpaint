import type { RoutePayload } from './routeApi.ts'
import type { WSIClass } from '../dataset.ts'

export type SampleWSImagesRequest = {
	genome: string
	dslabel: string
	sample_id: string
	wsimage: string
	index: number
}

export type SampleWSImagesResponse = {
	sampleWSImages: WSImage[]
}

export type WSImage = {
	filename: string
	overlays?: Array<string>
	predictionLayers?: Array<string>
	zoomInPoints?: Array<[number, number]>
	metadata: string
	annotationsData?: { zoomCoordinates: [number, number]; type: string; class: string; uncertainty: number }[]
	classes?: WSIClass[]
	uncertainty?: any
}

export const sampleWSImagesPayload: RoutePayload = {
	request: {
		typeId: 'SampleWSImagesRequest'
	},
	response: {
		typeId: 'SampleWSImagesResponse'
	}
	// examples: []
}
