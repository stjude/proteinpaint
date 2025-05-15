import { getCompInit, copyMerge } from '../../rx/index.js'
import { fillTermWrapper } from '#termsetting'
import { EventCountModel } from './model/eventCountModel.ts'
import { RunchartViewModel } from '../runchart/viewmodel/runchartViewModel.ts'
import { EventCountView } from './view/eventCountView.ts'
import { plotColor } from '#shared/common.js'
import { ScatterInteractivity } from '../scatter/viewmodel/scatterInteractivity.ts'
import { Runchart } from '../runchart/runchart.ts'
import { getColors } from '#shared/common.js'

export class EventCount extends Runchart {
	type: string
	cat2Color: any

	constructor() {
		super()
		this.type = 'eventCount'
	}

	async init(appState) {
		const state: any = this.getState(appState)
		this.config = structuredClone(state.config)
		this.filterTWs = []
		if (state.config.countryTW) this.filterTWs.push(state.config.countryTW)
		if (state.config.siteTW) this.filterTWs.push(state.config.siteTW)
		this.filtersData = await this.app.vocabApi.getAnnotatedSampleData({
			terms: structuredClone(this.filterTWs),
			termsPerRequest: 10
		})
		this.view = new EventCountView(this)
		this.model = new EventCountModel(this)
		this.vm = new RunchartViewModel(this)
		this.interactivity = new ScatterInteractivity(this)
	}

	async main() {
		this.config = structuredClone(this.state.config)
		this.settings = this.config.settings[this.type]

		await this.model.initData()
		await this.model.processData()
		this.cat2Color = getColors(this.model.charts.length)

		await this.setControls()
		this.vm.render()
		this.view.dom.loadingDiv.style('display', 'none')
		this.vm.setTools()
	}
}

export async function getPlotConfig(opts, app) {
	//if (!opts.colorTW) throw 'eventCount getPlotConfig: opts.colorTW{} missing'
	//if (!opts.name && !(opts.term && opts.term2)) throw 'eventCount getPlotConfig: missing coordinates input'

	const plot: any = {
		settings: {
			controls: {
				isOpen: false // control panel is hidden by default
			},
			eventCount: getDefaultEventCountSettings(),
			startColor: {}, //dict to store the start color of the gradient for each chart when using continuous color
			stopColor: {} //dict to store the stop color of the gradient for each chart when using continuous color
		}
	}

	try {
		const defaultConfig = app.vocabApi.termdbConfig?.plotConfigByCohort?.default?.[opts.chartType]
		copyMerge(plot, defaultConfig, opts)

		if (plot.colorTW) await fillTermWrapper(plot.colorTW, app.vocabApi)
		if (plot.shapeTW) await fillTermWrapper(plot.shapeTW, app.vocabApi)
		await fillTermWrapper(plot.term, app.vocabApi)
		if (plot.term0) await fillTermWrapper(plot.term0, app.vocabApi)
		if (plot.scaleDotTW) await fillTermWrapper(plot.scaleDotTW, app.vocabApi)
		if (plot.countryTW) await fillTermWrapper(plot.countryTW, app.vocabApi)
		if (plot.siteTW) await fillTermWrapper(plot.siteTW, app.vocabApi)
		return plot
	} catch (e) {
		console.log(e)
		throw `${e} [eventCount getPlotConfig()]`
	}
}

export const eventCountInit = getCompInit(EventCount)
// this alias will allow abstracted dynamic imports
export const componentInit = eventCountInit

export function getDefaultEventCountSettings() {
	return {
		size: 1,
		minShapeSize: 0.5,
		maxShapeSize: 4,
		scaleDotOrder: 'Ascending',
		refSize: 0.8,
		svgw: 1000,
		svgh: 500,
		axisTitleFontSize: 16,
		opacity: 0.6,
		defaultColor: plotColor,
		regression: 'None',
		// Color scale configuration settings
		// These settings control how numerical values are mapped to colors
		colorScaleMode: 'auto', // Default to automatic scaling based on data range
		// Other options: 'fixed' (user-defined range) or
		// 'percentile' (scale based on data distribution)

		colorScalePercentile: 95, // Default percentile for percentile mode
		// This means we'll scale colors based on values
		// up to the 95th percentile by default
		colorScaleMinFixed: null, // User-defined minimum value for fixed mode
		// Null indicates this hasn't been set yet
		colorScaleMaxFixed: null // User-defined maximum value for fixed mode
		// Null indicates this hasn't been set yet
		//3D Plot settings,
	}
}
