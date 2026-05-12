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
//Didn't add Deleted to FlagStatusMessages because deleted annotations dont exist and deleted predictons are filtered out in /Users/jsimps98/dev/sjpp/proteinpaint/server/routes/aiProjectSelectedWSImages.ts line 119
export const FlagStatusMessages = {
	[FlagStatus.Normal]: '',
	[FlagStatus.Skipped]: '(Skipped)',
	[FlagStatus.Flagged]: '(Flagged)'
}
