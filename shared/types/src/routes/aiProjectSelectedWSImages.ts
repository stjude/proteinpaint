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

// TODO move to another class
export interface TileSelection {
	zoomCoordinates: [number, number]
	class?: string
}

export enum AnnotationStatus {
	Normal = 0,
	Skipped = 1,
	Flagged = 2
}

export interface Annotation extends TileSelection {
	class: string
	status: number
	timestamp: string
	flag: AnnotationStatus
}

export interface Prediction extends TileSelection {
	class: string
	uncertainty: number
}

export const aiProjectSelectedWSImagesResponsePayload: RoutePayload = {
	request: {
		typeId: 'AiProjectSelectedWSImagesRequest'
	},
	response: {
		typeId: 'AiProjectSelectedWSImagesResponse'
	}
}
