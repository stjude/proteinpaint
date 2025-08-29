import type { TermWrapper, VariableItemEntry, NumericTW } from '#types'
import type { Elem, SvgG, SvgSvg, SvgText } from '../../types/d3.js'
import type { Menu } from '#dom'
import type { BasePlotConfig } from '#mass/types/mass'
import type { ScaleLinear } from 'd3'

export type CorrVolcanoOpts = {
	chartType: 'correlationVolcano'
	featureTw: TermWrapper
	/** No featureTw is passed from the tree in charts button.
	 * Use .numeric{} to create a featureTw.*/
	numeric?: TermWrapper
	/** Settings overrides */
	overrides?: Partial<CorrVolcanoSettings>
}

export type CorrVolcanoSettings = {
	/** Color for anti correlated, negative values. Default is red. */
	antiCorrColor: string
	/** Color for correlated, positive values. Default is blue. */
	corrColor: string
	/** Desired height of the plot. */
	height: number
	/** User has the ability to switch between adjusted or original
	 * p values. When true, adjusted p values are used. */
	isAdjustedPValue: boolean
	/** Correlation method */
	method: 'pearson' | 'spearman'
	/** Maximum radius of the circles Default is 20. */
	radiusMax: number
	/** Minimum radius of the circles. Default is 5.  */
	radiusMin: number
	/** statistically significant p value the user can alter
	 * Default is 0.05 */
	threshold: number
	/** Desired width of the plot. */
	width: number
}

export type CorrVolcanoPlotConfig = BasePlotConfig & {
	/** Numeric term used to plot */
	featureTw: NumericTW
}

export type CorrVolcanoDom = {
	/** Control panel to the left of the plot */
	controls: Elem
	/** Holder for the plot and legend */
	div: Elem
	/** Plot specific div for error messages. */
	error: Elem
	/** Sandbox header */
	header?: Elem
	/** Svg for legened items */
	legend: SvgG
	/** Plot. Contains everything except the axis labels and the title */
	plot: SvgG
	/** Holder for plot, axis labels, and title */
	svg: SvgSvg
	/** Text above the plot */
	title: SvgText
	/** Shared tooltip */
	tip: Menu
	/** Label appearing below the correlation axis */
	xAxisLabel: SvgText
	/** Label appearing to the left and vertically of the p value axis */
	yAxisLabel: SvgText
}

export type CorrVolcanoPlotDimensions = {
	/** Height and width of the svg */
	svg: {
		height: number
		width: number
	}
	/** Title above the plot */
	title: {
		text: string
		x: number
		y: number
	}
	/** Label below the x axis */
	xAxisLabel: {
		x: number
		y: number
	}
	/** Label to the left of the y axis */
	yAxisLabel: {
		x: number
		y: number
	}
	xScale: {
		scale: ScaleLinear<number, number>
		x: number
		y: number
	}
	yScale: {
		scale: ScaleLinear<number, number>
		x: number
		y: number
	}
	/** Dashed line appearing at x = 0 */
	divideLine: {
		x: number
		y1: number
		y2: number
	}
	/** Line appearing at the threshold value */
	thresholdLine: {
		y: number
		x1: number
		x2: number
	}
}

/** Attributes added to the response data */
export type VariableItem = VariableItemEntry & {
	color: string
	label: string
	/** x coordinate */
	x: number
	/** y coordinate */
	y: number
	/** radius of the circle */
	radius: number
	/** last x coordinate */
	previousX: number
	/** last y coordinate */
	previousY: number
}

/** Dimensions of sample size circles */
export type CorrVolcanoLegendData = {
	absMin: number
	absMax: number
	skippedVariables: { label: string }[]
}

/** Formated response data passed from the view model
 * to the view for rendering */
export type CorrVolcanoViewData = {
	/** Dimensions of all the plot elements except the data points */
	plotDim: CorrVolcanoPlotDimensions
	/** Rendering specifics for each data point */
	variableItems: VariableItem[]
	legendData: CorrVolcanoLegendData
}
