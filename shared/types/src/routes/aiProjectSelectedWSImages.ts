import type { RoutePayload } from './routeApi.ts'
import type { WSImage } from './samplewsimages.ts'

export type AiProjectSelectedWSImagesRequest = {
	genome: string
	dslabel: string
	projectId: number
	wsimagesFilenames: Array<string>
}

export type AiProjectSelectedWSImagesResponse = {
	// TODO create a type for WSImage with AI project specific fields
	wsimages: WSImage[]
}

export enum TileSelectionPrefix {
	SELECTION = 'selection_',
	ANNOTATION = 'annotation_',
	PREDICTION = 'prediction_'
}

// TODO move to another class
export interface TileSelection {
	zoomCoordinates: [number, number]
	id: string
	class?: string
}

export class TileSelectionImpl implements TileSelection {
	zoomCoordinates: [number, number]
	id: string
	class?: string

	constructor(zoomCoordinates: [number, number], className?: string) {
		this.zoomCoordinates = zoomCoordinates
		this.id = TileSelectionPrefix.SELECTION + JSON.stringify(zoomCoordinates)
		this.class = className
	}
}

export interface Annotation extends TileSelection {
	class: string
	status: number
	timestamp: string
}

export class AnnotationImpl implements Annotation {
	zoomCoordinates: [number, number]
	id: string
	class: string
	status: number
	timestamp: string

	constructor(
		zoomCoordinates: [number, number],
		className: string,
		status: number = 0,
		timestamp: string = new Date().toISOString()
	) {
		this.zoomCoordinates = zoomCoordinates
		this.id = TileSelectionPrefix.ANNOTATION + JSON.stringify(zoomCoordinates)
		this.class = className
		this.status = status
		this.timestamp = timestamp
	}
}

export interface Prediction extends TileSelection {
	class: string
	uncertainty: number
}

export class PredictionImpl implements Prediction {
	zoomCoordinates: [number, number]
	id: string
	class: string
	uncertainty: number

	constructor(zoomCoordinates: [number, number], className: string, uncertainty: number = 0) {
		this.zoomCoordinates = zoomCoordinates
		this.id = TileSelectionPrefix.PREDICTION + JSON.stringify(zoomCoordinates)
		this.class = className
		this.uncertainty = uncertainty
	}
}

export const aiProjectSelectedWSImagesResponsePayload: RoutePayload = {
	request: {
		typeId: 'AiProjectSelectedWSImagesRequest'
	},
	response: {
		typeId: 'AiProjectSelectedWSImagesResponse'
	}
}
