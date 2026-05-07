import { FlagStatus } from '@sjcrh/proteinpaint-types'
var FeaturePrefixes = /* @__PURE__ */ (FeaturePrefixes2 => {
	FeaturePrefixes2['Star'] = 'annotation-star-'
	FeaturePrefixes2['Square'] = 'annotation-square-'
	FeaturePrefixes2['Border'] = 'annotation-border-'
	FeaturePrefixes2['PredBorder'] = 'prediction-border-'
	return FeaturePrefixes2
})(FeaturePrefixes || {})
var SelectionPrefixes = /* @__PURE__ */ (SelectionPrefixes2 => {
	SelectionPrefixes2['TileSelection'] = 'ts_'
	SelectionPrefixes2['Prediction'] = 'pred_'
	SelectionPrefixes2['Annotation'] = 'anno_'
	return SelectionPrefixes2
})(SelectionPrefixes || {})
const FlagStatusMessages = {
	[FlagStatus.Normal]: '',
	[FlagStatus.Skipped]: '(Skipped)',
	[FlagStatus.Flagged]: '(Flagged)'
}
function createSelectionID(prefix, coordinates) {
	return prefix + JSON.stringify(coordinates)
}
function checkSelectionType(tileSelection, suspectedPrefix) {
	return tileSelection.id.startsWith(suspectedPrefix)
}
function createFeatureID(featurePrefix, coords) {
	return featurePrefix + JSON.stringify(coords)
}
export {
	FeaturePrefixes,
	FlagStatusMessages,
	SelectionPrefixes,
	checkSelectionType,
	createFeatureID,
	createSelectionID
}
