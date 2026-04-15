import type { Div, SvgG, SvgSvg, SvgText } from '../../../types/d3'

export type VolcanoPlotDom = {
	/** Holder for action buttons above the images and plot */
	actions: Div
	/** Holder for data points, p value line, and fold change line */
	plot: SvgG
	/** Div for the p-value table */
	pValueTable: Div
	/** Holder for plot, axis labels, and title */
	svg: SvgSvg
	/** Term info */
	top: SvgG
	/** X axis */
	xAxis: SvgG
	/** X axis label */
	xAxisLabel: SvgText
	/** Y axis */
	yAxis: SvgG
	/** Y axis label */
	yAxisLabel: SvgText
}
