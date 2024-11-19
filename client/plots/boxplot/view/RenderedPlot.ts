import type { RenderedBoxPlot } from '#dom'
import type { BoxPlotEntry } from '#types'

export type RenderedPlot = BoxPlotEntry & {
	boxplot: RenderedBoxPlot
	labColor: string
	x: number
	y: number
}
