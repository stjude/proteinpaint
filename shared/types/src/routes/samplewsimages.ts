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

export class WSImage {
	id?: number
	filename: string
	// TODO remove when it's verified
	annotationsAndPredictionsOverlay?: string
	predictionLayers?: Array<string>
	metadata?: string
	annotations?: Array<Annotation>
	predictions?: Array<Prediction>
	classes?: Array<WSIClass>
	/** ds defined uncertainity labels and colors */
	uncertainty?: any
	/** Color to highlight active patches */
	activePatchColor?: string
	/** Tile size in pixels needed for AI scripts */
	tileSize?: number
}

// TODO move to another class
export class TileSelection {
	zoomCoordinates: [number, number]
	class?: string
}

export class Annotation extends TileSelection {
	class: string
}

export class Prediction extends TileSelection {
	type: string
	class: string
	uncertainty: number
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
