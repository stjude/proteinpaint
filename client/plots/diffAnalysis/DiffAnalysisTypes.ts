import type { Elem, SvgG, SvgSvg, SvgText } from '../../types/d3'
import type { Menu } from '#dom'
import type { PlotConfig } from '#mass/types/mass'

export type DiffAnalysisPlotConfig = PlotConfig & {
	samplelst: string[]
}

export type DiffAnalysisDom = {
	/** Control panel to the left of the plot. Container is either provided or created */
	controls: Elem
	/** Holder */
	div: Elem
	/** Plot specific div for error messages. */
	error: Elem
	/** Sandbox header, if provided */
	header?: {
		title: Elem
		fixed: Elem
	}
	/** Holder for data points, p value line, and fold change line */
	plot: SvgG
	/** Holder for plot, axis labels, and title */
	svg: SvgSvg
	/** Shared tooltip */
	tip: Menu
	/** X axis */
	xAxis: SvgG
	/** X axis label */
	xAxisLabel: SvgText
	/** Y axis */
	yAxis: SvgG
	/** Y axis label */
	yAxisLabel: SvgText
}

/** Opts to init the DEanalysis plot */
export type DiffAnalysisOpts = {
	/** Container for the plot */
	holder: Elem
	/** Optional container for the controls. */
	controls?: Elem
	/** Optional sandbox header */
	header?: Elem
	/** Settings overrides, in runpp() call */
	overrides?: Partial<DiffAnalysisSettings>
}

/** Settings DEanalysis */
export type DiffAnalysisSettings = {
	/** smallest number of reads required for a gene to be considered in the analysis */
	minCount: number
	/** smallest total number of reads required for a gene to be considered in the analysis */
	minTotalCount: number
	/** Number of variable genes used in parametric DE analysis*/
	varGenesCutoff: number
}
