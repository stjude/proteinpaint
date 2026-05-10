export enum FlagStatus {
	Normal = 0,
	Skipped = 1,
	Flagged = 2,
	Deleted = 3
}

export enum FeaturePrefixes {
	Star = 'annotation-star-',
	Square = 'annotation-square-',
	Border = 'annotation-border-',
	PredBorder = 'prediction-border-'
}

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
}
