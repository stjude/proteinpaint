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

export const SelectionPrefixes = {
	TileSelection: 'ts_',
	Prediction: 'pred_',
	Annotation: 'anno_'
} as const

export type SelectionPrefixType = (typeof SelectionPrefixes)[keyof typeof SelectionPrefixes]

export const FeaturePrefixes = {
	Star: `annotation-star-`,
	Square: `annotation-square-`,
	Border: 'annotation-border-',
	PredBorder: 'prediction-border-'
} as const

export type FeaturePrefixType = (typeof FeaturePrefixes)[keyof typeof FeaturePrefixes]

export interface FlagPredictionInfo {
	flag: FlagStatusType
	timestamp: string
}

export function createSelectionID(prefix: SelectionPrefixType, coordinates: [number, number]): string {
	return prefix + JSON.stringify(coordinates)
}

export function checkSelectionType(tileSelection: TileSelection, suspectedPrefix: SelectionPrefixType): boolean {
	return tileSelection.id.startsWith(suspectedPrefix)
}

export function createFeatureID(featurePrefix: FeaturePrefixType, coords: [number, number]) {
	return featurePrefix + JSON.stringify(coords)
}

// TODO move to another class
export interface TileSelection {
	zoomCoordinates: [number, number]
	class?: string
	flag: FlagStatusType
	id: string
	timestamp: string
}

export const FlagStatus = {
	Normal: 0,
	Skipped: 1,
	Flagged: 2,
	Deleted: 3
} as const

export type FlagStatusType = (typeof FlagStatus)[keyof typeof FlagStatus]

export const FlagStatusMessages = {
	[FlagStatus.Normal]: '',
	[FlagStatus.Skipped]: '(Skipped)',
	[FlagStatus.Flagged]: '(Flagged)'
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
