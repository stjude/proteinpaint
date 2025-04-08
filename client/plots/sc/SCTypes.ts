import type { Elem } from '../../types/d3'
import type { PlotConfig } from '#mass/types/mass'

export type SCConfig = PlotConfig & {
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
	header: Elem
}
