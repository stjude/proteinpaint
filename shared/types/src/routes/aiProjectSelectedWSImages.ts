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

export enum SelectionPrefixes {
	TileSelection = 'ts_',
	Prediction = 'pred_',
	Annotation = 'anno_'
}

export enum FeaturePrefixes {
	Star = `annotation-star-`,
	Square = `annotation-square-`,
	Border = 'annotation-border-',
	PredBorder = 'prediction-border-'
}

export interface FlagPredictionInfo {
	flag: FlagStatus
	timestamp: string
}

export function createSelectionID(prefix: SelectionPrefixes, coordinates: [number, number]): string {
	return prefix + JSON.stringify(coordinates)
}

export function checkSelectionType(tileSelection: TileSelection, suspectedPrefix: SelectionPrefixes): boolean {
	return tileSelection.id.startsWith(suspectedPrefix)
}

export function createFeatureID(featurePrefix: FeaturePrefixes, coords: [number, number]) {
	return featurePrefix + JSON.stringify(coords)
}

// TODO move to another class
export interface TileSelection {
	zoomCoordinates: [number, number]
	class?: string
	flag: FlagStatus
	id: string
	timestamp: string
}

export enum FlagStatus {
	Normal = 0,
	Skipped = 1,
	Flagged = 2,
	Deleted = 3
}

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
