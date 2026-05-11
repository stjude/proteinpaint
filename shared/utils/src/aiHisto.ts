import { type TileSelection } from '@sjcrh/proteinpaint-types'
import type { FeaturePrefixes, SelectionPrefixValues } from '../constants/AiHisto.js'

export function createSelectionID(prefix: SelectionPrefixValues, coordinates: [number, number]): string {
	return prefix + JSON.stringify(coordinates)
}

export function checkSelectionType(tileSelection: TileSelection, suspectedPrefix: SelectionPrefixValues): boolean {
	return tileSelection.id.startsWith(suspectedPrefix)
}

export function createFeatureID(featurePrefix: FeaturePrefixes, coords: [number, number]) {
	return featurePrefix + JSON.stringify(coords)
}
