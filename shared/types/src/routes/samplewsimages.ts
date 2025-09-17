import type { RoutePayload } from './routeApi.ts'
import type { WSIClass } from '../dataset.ts'
import type { Annotation, Prediction } from './aiProjectSelectedWSImages.ts'

export type SampleWSImagesRequest = {
	genome: string
	dslabel: string
	sample_id: string
	wsimage: string
}

export type SampleWSImagesResponse = {
	sampleWSImages: WSImage[]
}

export class WSImage {
	id?: number
	filename: string
	metadata?: string
	predictionLayers?: Array<string>
	annotations?: Array<Annotation>
	predictions?: Array<Prediction>
	classes?: Array<WSIClass>
	/** ds defined uncertainity labels and colors */
	uncertainty?: any
	/** Color to highlight active patches */
	activePatchColor?: string
	/** Tile size in pixels needed for AI scripts */
	tileSize?: number

	constructor(filename: string) {
		this.filename = filename
	}
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
