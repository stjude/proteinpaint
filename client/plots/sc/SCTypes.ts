import type { Elem } from '../../types/d3'

export type SCConfig = {
	chartType: 'sc'
	/** Should match a tab in the sc app */
	childType: string
	/** Common settings and settings for each child component/plot */
	settings: object
}

export type SCConfigOpts = {
	/** Settings overrides */
	overrides?: any
}

export type SCViewerOpts = {
	holder: Elem
	controls: Elem
}
