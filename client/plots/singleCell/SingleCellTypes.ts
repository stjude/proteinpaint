import type { BasePlotConfig, BasePlotOpts } from '../../mass/types/mass'
import type { SingleCellPlotResponse, SingleCellPlot, SingleCellSample } from '#types'
import type { ScaleLinear } from 'd3'

export type SingleCellConfig = BasePlotConfig & {
	chartType?: 'singleCell'
	childType?: 'singleCell'
	plots: SingleCellPlot[]
	hiddenClusters?: any
	settings: {
		singleCell: SingleCellSettings
	}
}

export type SingleCellSettings = {
	/** Defines the radius of the dots. Default is 0.04 */
	dotSize: number
	/** Defines the opacity for the dots. Default is 0.8 */
	dotOpacity: number
	/** The height of each individual plot. Default is 600 */
	height: number
	/** Show a grid over the plot */
	showGrid: boolean
	startColor: SettingColor
	stopColor: SettingColor
	/** The width of each individual plot. Default is 600 */
	width: number
}

/** Reused data object for the plot colors */
type SettingColor = {
	/** index corresponds to a plot name. The value is the color */
	[index: string]: string
}

export type SingleCellPlotOpts = BasePlotOpts & {
	sample: SingleCellSample
}

export type SingleCellViewData = {
	actions: SingleCellActionsData
	plotsData: SingleCellFormattedPlotData[]
}

type SingleCellActionsData = {
	plots: { name: string; selected: boolean }[]
}

export type SingleCellFormattedPlotData = SingleCellPlotResponse & {
	cells: any
	clusters: any
	id: string
	xScale: ScaleLinear<number, number>
	yScale: ScaleLinear<number, number>
}
