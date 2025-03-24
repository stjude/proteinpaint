import type { Div, Elem, SvgG, SvgSvg, SvgText } from '../../types/d3'
import type { PlotConfig } from '#mass/types/mass'
import type { TermWrapper } from '@sjcrh/proteinpaint-types'
import type { TableCell, TableColumn, Menu } from '#dom'
import type { DataEntry, DEImage } from '#types'

/** Attributes are added in the view model
 * to the response data for rendering. */
export type DataPointEntry = DataEntry & {
	/** color indicating significance */
	color: string
	/** If true, the fill opacity increases to show the highlight color */
	highlighted: boolean
	/** x coordinate */
	x: number
	/** y coordinate */
	y: number
	/** radius */
	radius: number
}

/** Final config created in getPlotConfig() */
export type VolcanoPlotConfig = PlotConfig & {
	/** Array of confounders. Default is [] */
	confounderTws: TermWrapper[]
	/** Data points highlighted in the volcano plot. Default is []*/
	highlightedData: string[]
	samplelst: {
		groups: {
			name: string
			samplelst: string[]
		}[]
	}
	/** Custom group term */
	tw: TermWrapper
	/** Determines the kind of diff analysis */
	termType: string
}

/** Data needed to render the scales, plot, etc.
 * Generated by the view model  */
export type VolcanoPlotDimensions = {
	logFoldChangeLine: { x: number; y1: number; y2: number }
	plot: { width: number; height: number; x: number; y: number }
	svg: { width: number; height: number }
	xAxisLabel: { x: number; y: number }
	xScale: { x: number; y: number; scale: any }
	yAxisLabel: { x: number; y: number; text: string }
	yScale: { x: number; y: number; scale: any }
}

export type VolcanoOpts = {
	holder: Elem
	controls: Elem
	termType: string
	diffAnalysisInteractions?: any
	confounderTws?: TermWrapper[]
	highlightedData?: string[]
	samplelst: {
		groups: {
			name: string
			samplelst: string[]
		}[]
	}
	overrides?: Partial<VolcanoSettings>
}

/** Main dom elements created on init() */
export type VolcanoDom = {
	holder: Elem
	/** Either the elem passed from parent component or created
	 * div from the holder. */
	controls: Elem
	/** Div set aside for showing user error messages */
	error: Elem
	/** Loading message */
	wait: Elem
	/** Tooltip for data points */
	tip: Menu
	/** Menu for action buttons above the volcano plot */
	actionsTip: Menu
}

/** this.volcanoDom in view */
export type VolcanoPlotDom = {
	/** Holder for action buttons above the images and plot */
	actions: Div
	/** Div for server generated images */
	images: Div
	/** Holder for data points, p value line, and fold change line */
	plot: SvgG
	pValueTable: Div
	stats: Div
	/** Holder for plot, axis labels, and title */
	svg: SvgSvg
	/** X axis */
	xAxis: SvgG
	/** X axis label */
	xAxisLabel: SvgText
	/** Y axis */
	yAxis: SvgG
	/** Y axis label */
	yAxisLabel: SvgText
}

export type VolcanoPValueTableData = {
	columns: TableColumn[]
	rows: TableCell[][]
}

/** Settings for the differential analysis volcano */
export type VolcanoSettings = {
	/** Default color for highlighted data points. Maybe overridden by assigned term color */
	defaultHighlightColor: string
	/** Default color for non-significant data points. Maybe overridden by assigned term color */
	defaultNonSignColor: string
	/** Default color for significant data points. Maybe overridden by assigned term color */
	defaultSignColor: string
	/** largest absolute fold change to be considered in the analysis */
	foldChangeCutoff: number
	method: 'wilcoxon' | 'edgeR'
	/** Not enabling this feature for now */
	// geneORA: 'upregulated' | 'downregulated' | 'both' | undefined
	/** smallest number of reads required for a gene to be considered in the analysis */
	minCount: number
	/** smallest total number of reads required for a gene to be considered in the analysis */
	minTotalCount: number
	/** p value cutoff for significance */
	pValue: number
	/** Users may switch between 'original' and 'adjusted' p values */
	pValueType: 'original' | 'adjusted'
	/** Toggle between ranking the genes by variance or abs(foldChange) */
	rankBy: 'abs(foldChange)' | 'pValue'
	/** If true, show server generated images. If false, hide div. */
	showImages: boolean
	showPValueTable: boolean
	showStats: boolean
	/** plot height */
	height: number
	/** plot width */
	width: number
}

/** Formatted data from the view model */
export type VolcanoViewData = {
	statsData: { label: string; value: number }[]
	plotDim: VolcanoPlotDimensions
	pointData: DataPointEntry[]
	pValueTableData: VolcanoPValueTableData
	images: DEImage[]
}
