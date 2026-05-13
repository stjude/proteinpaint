// uncomment the imports below, save, and commit to trigger eslint checks in the
// git pre-commit hook, or run the command below from the proteinpaint dir,
// `npx eslint --env shared-node-browser shared/utils/constants/AiHisto.ts`
// -- start trigger eslint check failures --
// import { joinUrl } from '../src/joinUrl.js'
// import { type BaseTvs } from '#types'
// import { runproteinpaint } from '@sjcrh/proteinpaint-client'
// const a: BaseTvs = {}
// console.log(a, joinUrl, runproteinpaint)
//  -- end trigger eslint check failures --

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
