import type { Elem, SvgSvg } from '../../types/d3'
import type { Menu } from '#dom'
import type { PlotConfig } from '#mass/types/mass'

export type DEanalysisPlotConfig = PlotConfig & {
	samplelst: string[]
}

export type DEanalysisDom = {
	/** Control panel to the left of the plot. Container is either provided or created */
	controls: Elem
	/** Holder */
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
	/** Optional container for the controls. */
	controls?: Elem
	/** Optional sandbox header */
	header?: Elem
	/** Settings overrides, in runpp() call */
	overrides?: Partial<DEanalysisSettings>
}

/** Settings DEanalysis */
export type DEanalysisSettings = {
	/** smallest number of reads required for a gene to be considered in the analysis */
	minCount: number
	/** smallest total number of reads required for a gene to be considered in the analysis */
	minTotalCount: number
	/** Number of variable genes used in parametric DE analysis*/
	varGenesCutoff: number
}
