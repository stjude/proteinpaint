import type { BoxPlotSettings } from '../Settings'
import type { ViewData, BoxPlotConfig } from '../BoxPlotTypes'
import { LegendDataMapper } from './LegendDataMapper'
import { ChartsDataMapper } from './ChartsDataMapper'

export class ViewModel {
	viewData: ViewData
	rowHeight: number
	rowSpace: number

	constructor(
		config: BoxPlotConfig,
		data: any,
		settings: BoxPlotSettings,
		maxLabelLgth: number,
		useDefaultSettings: boolean
	) {
		const chartsMapper = new ChartsDataMapper(data, settings, maxLabelLgth, useDefaultSettings)
		const legendMapper = new LegendDataMapper(config)

		const charts = chartsMapper.map(config)

		this.rowHeight = chartsMapper.rowHeight
		this.rowSpace = chartsMapper.rowSpace

		this.viewData = {
			backgroundColor: settings.displayMode == 'dark' ? 'black' : 'white',
			textColor: settings.displayMode == 'dark' ? 'white' : 'black',
			charts,
			legend: legendMapper.map(data.charts, data.uncomputableValues || [])
		}
	}
}
