import type { RoutePayload } from './routeApi.ts'
import type { WSIClass } from '../dataset.ts'

export type SampleWSImagesRequest = {
	genome: string
	dslabel: string
	sample_id: string
	wsimage: string
}

export type SampleWSImagesResponse = {
	sampleWSImages: WSImage[]
}

export type WSImage = {
	id?: string
	filename: string
	overlays?: Array<string>
	predictionLayers?: Array<string>
	metadata: string
	annotationsData?: Array<Annotation>
	predictions?: Array<Prediction>
	classes?: Array<WSIClass>
	/** ds defined uncertainity labels and colors */
	uncertainty?: any
	/** Color to highlight active patches */
	activePatchColor?: string
	/** Tile size in pixels needed for AI scripts */
	tileSize?: number
}

export type Annotation = {
	zoomCoordinates: [number, number]
	class: string
}

export type Prediction = {
	zoomCoordinates: [number, number]
	type: string
	class: string
	uncertainty: number
}

export type TileSelection = {
	zoomCoordinates: [number, number]
	class?: string
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
