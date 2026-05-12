import type { RoutePayload } from './routeApi.ts'
import type { WSImage } from './samplewsimages.ts'
import type { FlagStatusValues } from '#shared/devTs'

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

export interface FlagPredictionInfo {
	flag: FlagStatusValues
	timestamp: string
}

// TODO move to another class
export interface TileSelection {
	zoomCoordinates: [number, number]
	class?: string
	flag: FlagStatusValues
	id: string
	timestamp: string
}

export interface Annotation extends TileSelection {
	class: string
	status: number
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
