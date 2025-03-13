import type { Div, Elem, SvgG, SvgSvg, SvgText } from '../../types/d3'
import type { PlotConfig } from '#mass/types/mass'
import type { TermWrapper } from '@sjcrh/proteinpaint-types'
import type { Cell, Column, Menu } from '#dom'
import type { DataEntry } from '#types'

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

export type VolcanoPlotConfig = PlotConfig & {
	/** Array of confounders */
	confounderTws: TermWrapper[]
	/** Data points highlighted in the volcano plot */
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

export type VolcanoPlotDimensions = {
	logFoldChangeLine: { x: number; y1: number; y2: number }
	plot: { width: number; height: number; x: number; y: number }
	svg: { width: number; height: number }
	xAxisLabel: { x: number; y: number }
	xScale: { x: number; y: number; scale: any }
	yAxisLabel: { x: number; y: number; text: string }
	yScale: { x: number; y: number; scale: any }
}

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

export type VolcanoPlotDom = {
	actions: Div
	/** Holder for data points, p value line, and fold change line */
	plot: SvgG
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
	images: any
}

export type VolcanoPValueTableData = {
	columns: Column[]
	rows: Cell[][]
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
	/** Show a table of p values */
	showPValueTable: boolean
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
	images: any
}
