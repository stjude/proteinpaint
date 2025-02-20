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
	/** X axis label */
	xAxisLabel: SvgText
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
	/** largest absolute fold change to be considered in the analysis */
	foldChangeCutoff: number
	/** smallest number of reads required for a gene to be considered in the analysis */
	minCount: number
	/** smallest total number of reads required for a gene to be considered in the analysis */
	minTotalCount: number
	/** p value cutoff for significance */
	pValue: number
	/** Users may switch between 'original' and 'adjusted' p values */
	pValueType: 'original' | 'adjusted'
	/** Number of variable genes used in parametric DE analysis*/
	varGenesCutoff: number
	/** plot height */
	height: number
	/** plot width */
	width: number
}

/** Formatted data from the view model */
export type DiffAnalysisViewData = {
	statsData: { label: string; value: number }[]
	plotDim: DiffAnalysisPlotDim
	pointData: PointDataEntry[]
}

export type DiffAnalysisPlotDim = {
	logFoldChangeLine: { x: number; y1: number; y2: number }
	plot: { width: number; height: number; x: number; y: number }
	svg: { width: number; height: number }
	xAxisLabel: { x: number; y: number }
	xScale: { x: number; y: number; scale: any }
	yAxisLabel: { x: number; y: number; text: string }
	yScale: { x: number; y: number; scale: any }
}

export type PointDataEntry = {
	adjusted_p_value: number
	/** color indicating significance */
	color: string
	fold_change: number
	gene_name: string
	gene_symbol: string
	log_fold_change: number
	original_p_value: number
	/** x coordinate */
	x: number
	/** y coordinate */
	y: number
	/** radius */
	radius: number
}
