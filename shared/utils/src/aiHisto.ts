import { type TileSelection } from '@sjcrh/proteinpaint-types'
import { FlagStatus } from '#types/checkers'

export enum FeaturePrefixes {
	Star = 'annotation-star-',
	Square = 'annotation-square-',
	Border = 'annotation-border-',
	PredBorder = 'prediction-border-'
}

export enum SelectionPrefixes {
	TileSelection = 'ts_',
	Prediction = 'pred_',
	Annotation = 'anno_'
}

export const FlagStatusMessages = {
	[FlagStatus.Normal]: '',
	[FlagStatus.Skipped]: '(Skipped)',
	[FlagStatus.Flagged]: '(Flagged)'
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
