import type { BoxPlotSettings } from '../Settings'
import type { /**ViewData,*/ BoxPlotConfig } from '../BoxPlotTypes'
import { LegendDataMapper } from './LegendDataMapper'
import { ChartDataMapper } from './ChartDataMapper'

export class ViewModel {
	// viewData: ViewData
	viewData: any

	constructor(
		config: BoxPlotConfig,
		data: any,
		settings: BoxPlotSettings,
		maxLabelLgth: number,
		useDefaultSettings: boolean
	) {
		const chartMapper = new ChartDataMapper(data, settings, maxLabelLgth, useDefaultSettings)
		const legendMapper = new LegendDataMapper(config)

		const charts = chartMapper.map(config)

		this.viewData = {
			backgroundColor: settings.displayMode == 'dark' ? 'black' : 'white',
			textColor: settings.displayMode == 'dark' ? 'white' : 'black',
			charts,
			legend: legendMapper.map(charts, data.uncomputableValues || [])
		}
	}
}
