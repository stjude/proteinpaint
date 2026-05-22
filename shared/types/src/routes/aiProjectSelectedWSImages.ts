import type { WSImage } from './samplewsimages.ts'

export const FlagStatus = {
	Normal: 0,
	Skipped: 1,
	Flagged: 2,
	Deleted: 3
} as const

export type FlagStatusValues = (typeof FlagStatus)[keyof typeof FlagStatus]

export const FeaturePrefixes = {
	Star: 'annotation-star-',
	Square: 'annotation-square-',
	Border: 'annotation-border-',
	PredBorder: 'prediction-border-'
} as const

export type FeaturePrefixValues = (typeof FeaturePrefixes)[keyof typeof FeaturePrefixes]

export const SelectionPrefixes = {
	TileSelection: 'ts_',
	Prediction: 'pred_',
	Annotation: 'anno_'
} as const

export type SelectionPrefixValues = (typeof SelectionPrefixes)[keyof typeof SelectionPrefixes]

export const FlagStatusMessages = {
	[FlagStatus.Normal]: '',
	[FlagStatus.Skipped]: '(Skipped)',
	[FlagStatus.Flagged]: '(Flagged)'
	// Didn't add Deleted to FlagStatusMessages because deleted annotations dont exist
	// and deleted predictons are filtered out in proteinpaint/server/routes/aiProjectSelectedWSImages.ts around line 119
}

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
}

export interface Prediction extends TileSelection {
	class: string
	uncertainty: number
}

export function createSelectionID(prefix: SelectionPrefixValues, coordinates: [number, number]): string {
	return prefix + JSON.stringify(coordinates)
}

export function checkSelectionType(tileSelection: TileSelection, suspectedPrefix: SelectionPrefixValues): boolean {
	return tileSelection.id.startsWith(suspectedPrefix)
}

export function createFeatureID(featurePrefix: FeaturePrefixValues, coords: [number, number]) {
	return featurePrefix + JSON.stringify(coords)
}

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
