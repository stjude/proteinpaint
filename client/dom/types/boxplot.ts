import type { BoxPlotData } from '#types'
import type { SvgLine, SvgRect, SvgText } from 'types/d3'

export type RenderedBoxPlot = BoxPlotData & {
	/** box from Q1 - Q3 */
	box: SvgRect
	/** center line connecting the whiskers */
	hline: SvgLine
	/** g element for the label */
	labelG: SvgText
	/** vertical line in the center of the box rect for the median */
	linep50: SvgLine
	/** vertical line for the first whisker */
	linew1: SvgLine
	/** vertical line for the second whisker */
	linew2: SvgLine
}
