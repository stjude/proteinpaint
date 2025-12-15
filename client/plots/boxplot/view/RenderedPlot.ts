import type { RenderedBoxPlot } from '#dom'
import type { BoxPlotEntry } from '#types'

export type RenderedPlot = BoxPlotEntry & {
	boxplot: RenderedBoxPlot
	x: number
	y: number
}
