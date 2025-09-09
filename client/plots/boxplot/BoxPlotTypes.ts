import type { Menu } from '#dom'
import type { PlotConfig } from '#mass/types/mass'
import type { BoxPlotEntry, BoxPlotData, TermWrapper } from '#types'
import type { Div, Elem } from '../../types/d3'

/** Opts sent from mass */
export type TdbBoxPlotOpts = {
	holder: Elem
	controls?: Elem
	header?: Elem
	numericEditMenuVersion?: string[]
}

export type BoxPlotConfigOpts = {
	term: TermWrapper
	term2?: TermWrapper
	term0?: TermWrapper
	overrides?: any
}

export type BoxPlotConfig = PlotConfig

/** User controlled settings. Some settings are calculated based on
 * the number of boxplots */
export type BoxPlotSettings = {
	/** Width of the boxplots and scale, excluding labels */
	boxplotWidth: number
	/** Default is common plot color.  */
	color: string
	/** Toggle between different display modes
	 * 'default': colored lines on white background
	 * 'filled': black lines with filled rects on white background
	 * 'dark': lighted colored lines on black background */
	displayMode: string
	/** Padding between the left hand label and boxplot */
	labelPad: number
	/** Toggle between a linear and log scale
	 * When true, renders a log scale. Default is false */
	isLogScale: boolean
	/** Toggle between vertical and horizontal orientation.
	 * The default is false */
	isVertical: boolean
	/** If true, order box plots from smallest to largest median value
	 * Default is by alphanumeric order or by bin
	 * May change this later to `orderBy` if more options arise */
	orderByMedian: boolean
	/** Height of individual boxplots */
	rowHeight: number
	/** Space between the boxplots */
	rowSpace: number
}

/** Descriptions of the dom elements for the box plot */
export type BoxPlotDom = {
	/** Controls div for the hamburger menu */
	controls: Elem
	/** Main div */
	div: Div
	/** Error messages */
	error: Div
	/** Sandbox header */
	header?: Elem
	/** Legend */
	legend: Div
	/** Div for charts, each chart contains a set of boxplots */
	charts: Div
	/** box plot tooltip (e.g. over the outliers) */
	tip: Menu
}

/** Processed box plot obj with dimensions needs for
 * rendering in the view. */
export type FormattedPlotEntry = BoxPlotEntry & {
	boxplot: BoxPlotData & {
		label: string
		/** if outliers are present, set the radius
		 * instead of using the rather large default */
		radius?: number
	}
	/** offset for the label div */
	x: number
	/** incrementing, descending offset for each new plot  */
	y: number
	/** Plot label color. Changes per displayMode selection */
	labColor: string
}

export type LegendItemEntry = {
	/** Key for value look up in tw.term object */
	key: string
	/** If true, line-through text */
	isHidden: boolean
	/** If true, triggers a callback to unhide a plot on click,
	 * creates an icon, and tooltip for the item.
	 */
	isPlot: boolean
	/** Text shown in the legend
	 * Uncomputable values and hidden plots report total count as n
	 * Descriptive stats report value after colon
	 */
	text: string
}

export type LegendData = { label: string; items: LegendItemEntry[] }[]

/**
 * Calculates the dimensions and html attributes for the svg and
 * individual boxplots. The data is passed to the View class.
 */
export type PlotDimensions = {
	/** Changes background color between white and soft black
	 * based on displayMode selection */
	backgroundColor: string
	/** Domain for the axis */
	domain: number[]
	/** Range for the axis */
	range: number[]
	svg: {
		/** Width of the svg */
		width: number
		/** Height of the svg */
		height: number
	}
	/** Changes text color for the axis, plot labels, and legend
	 * between black and white based on displayMode selection */
	textColor: string
	/** Title of chart */
	chartTitle: string
	/** Title of the plot and coordinates */
	title: { x: number; y: number; text: string }
	/** axis coordinates */
	axis: { x: number; y: number; values(ticks: number[]): number[]; format(d: number): string }
}

export type ViewData = {
	plotDim: PlotDimensions
	plots: FormattedPlotEntry[]
	legend: { label: string; items: LegendItemEntry[] }[]
}
