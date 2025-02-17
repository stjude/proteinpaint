import type { Elem, SvgSvg } from '../../types/d3'
import type { Menu } from '#dom'

export type DEanalysisDom = {
	/** Control panel to the left of the plot */
	controls: Elem
	/** Holder for the plot and legend */
	div: Elem
	/** Plot specific div for error messages. */
	error: Elem
	/** Sandbox header, if provided */
	header?: Elem
	/** Holder for plot, axis labels, and title */
	svg: SvgSvg
	/** Shared tooltip */
	tip: Menu
}

/** Opts to init the DEanalysis plot */
export type DEanalysisOpts = {
	/** Container for the plot */
	holder: Elem
	/** Container for the controls */
	controls?: Elem
	/** Optional sandbox header */
	header?: Elem
	/** Settings overrides */
	overrides?: Partial<DEanalysisSettings>
}

/** Settings DEanalysis */
export type DEanalysisSettings = {
	minCount: number
	minTotalCount: number
}
