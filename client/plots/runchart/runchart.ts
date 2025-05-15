import { getCompInit, copyMerge } from '../../rx/index.js'
import { fillTermWrapper } from '#termsetting'
import { RunchartModel } from './model/runchartModel.js'
import { RunchartViewModel } from './viewmodel/runchartViewModel.js'
import { RunchartView } from './view/runchartView.js'
import { plotColor } from '#shared/common.js'
import { ScatterInteractivity } from '../scatter/viewmodel/scatterInteractivity.js'
import { controlsInit } from '../controls.js'
import { downloadSingleSVG } from '../../common/svg.download.js'
import { select2Terms } from '#dom/select2Terms'
import { Scatter } from '../scatter/scatter.js'
import { getColors } from '#shared/common.js'
import { filterJoin } from '#filter'

export class Runchart extends Scatter {
	type: string
	cat2Color: any
	runchartvm!: RunchartViewModel
	filterTWs: any
	filtersData: any

	constructor() {
		super()
		this.type = 'runChart'
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
		this.view = new RunchartView(this)
		this.model = new RunchartModel(this)
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

	processTW(tw, value, excluded, lst) {
		if (value && !excluded.includes(tw.$id))
			lst.push({
				type: 'tvs',
				tvs: {
					term: tw.term,
					values: [{ key: value }]
				}
			})
	}

	getList(tw, samplesPerFilter: any) {
		const values: any = Object.values(tw.term.values)
		values.sort((v1: any, v2: any) => v1.label.localeCompare(v2.label))
		const twSamples = samplesPerFilter[tw.term.id]
		const data: any = []
		for (const sample of twSamples) {
			data.push(this.filtersData.samples[sample])
		}
		//select samples with data for that term
		const sampleValues = Array.from(new Set(data.map(sample => sample[tw.$id]?.value)))
		for (const value of values) {
			value.value = value.label
			value.disabled = tw.term.id != this.config.countryTW.term.id ? !sampleValues.includes(value.label) : false
		}
		values.unshift({ label: '', value: '' })
		if (!(tw.term.id in this.settings)) this.settings[tw.term.id] = values[0].label
		return values
	}

	async setControls() {
		this.view.dom.controlsHolder.selectAll('*').remove()
		const inputs = await this.view.getControlInputs()
		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: this.view.dom.controlsHolder,
				inputs
			})
		}
		// TODO: handle multiple chart download when there is a divide by term
		this.components.controls.on('downloadClick.scatter', () => {
			downloadSingleSVG(this.view.dom.svg, 'scatter.svg', this.opts.holder.node())
		})
	}

	setCountry(country) {
		const config: any = this.config
		this.settings[config.countryTW.term.id] = country
		this.settings[config.siteTW.term.id] = '' //clear site if country is changed
		config.filter = this.getFilter()
		console.log('setCountry', country, config)
		this.app.dispatch({ type: 'plot_edit', id: this.id, config })
	}

	setFilterValue(key, value) {
		const config: any = this.config
		this.settings[key] = value
		config.filter = this.getFilter()
		console.log('setFilterValue', key, value, config)
		this.app.dispatch({ type: 'plot_edit', id: this.id, config: this.config })
	}

	getFilter(tw: any = null) {
		const excluded: any = []
		if (tw) excluded.push(tw.$id)
		const lst = []
		for (const tw of this.filterTWs) this.processTW(tw, this.settings[tw.term.id], excluded, lst)

		const tvslst = {
			type: 'tvslst',
			in: true,
			join: 'and',
			lst
		}
		const filter = filterJoin([this.state.termfilter.filter, tvslst])
		return filter
	}
}

export async function getPlotConfig(opts, app) {
	//if (!opts.colorTW) throw 'runChart getPlotConfig: opts.colorTW{} missing'
	//if (!opts.name && !(opts.term && opts.term2)) throw 'runChart getPlotConfig: missing coordinates input'
	const defaultConfig = app.vocabApi.termdbConfig?.plotConfigByCohort?.default?.[opts.chartType]
	const settings = copyMerge(getDefaultRunChartSettings(), defaultConfig?.settings)
	const plot: any = {
		settings: {
			controls: {
				isOpen: false // control panel is hidden by default
			},
			runChart: settings,
			startColor: {}, //dict to store the start color of the gradient for each chart when using continuous color
			stopColor: {} //dict to store the stop color of the gradient for each chart when using continuous color
		}
	}

	try {
		if (plot.colorTW) await fillTermWrapper(plot.colorTW, app.vocabApi)
		if (plot.shapeTW) await fillTermWrapper(plot.shapeTW, app.vocabApi)
		if (!plot.term.q) plot.term.q = {}
		if (!plot.term2.q) plot.term2.q = {}
		plot.term.q.mode = 'continuous'
		plot.term2.q.mode = 'continuous'
		await fillTermWrapper(plot.term, app.vocabApi)
		await fillTermWrapper(plot.term2, app.vocabApi)
		if (plot.term0) await fillTermWrapper(plot.term0, app.vocabApi)
		if (plot.scaleDotTW) await fillTermWrapper(plot.scaleDotTW, app.vocabApi)
		if (plot.countryTW) await fillTermWrapper(plot.countryTW, app.vocabApi)
		if (plot.siteTW) await fillTermWrapper(plot.siteTW, app.vocabApi)

		return plot
	} catch (e) {
		console.log(e)
		throw `${e} [runChart getPlotConfig()]`
	}
}

export const runChartInit = getCompInit(Runchart)
// this alias will allow abstracted dynamic imports
export const componentInit = runChartInit

export function makeChartBtnMenu(holder, chartsInstance) {
	/*
	holder: the holder in the tooltip
	chartsInstance: MassCharts instance
		termdbConfig is accessible at chartsInstance.state.termdbConfig{}
		mass option is accessible at chartsInstance.app.opts{}
	*/
	holder.append('div')
	const callback = (xterm, yterm) => {
		chartsInstance.app.dispatch({
			type: 'plot_create',
			config: {
				chartType: 'runChart',
				term: { term: xterm, q: { mode: 'continuous' } },
				term2: { term: yterm, q: { mode: 'continuous' } },
				name: `${xterm.name} vs ${yterm.name}`
			}
		})
	}
	//the first time should be a date and the second one a numeric non date term
	select2Terms(chartsInstance.dom.tip, chartsInstance.app, 'runChart', 'date', callback, 'numeric')
}

export function getDefaultRunChartSettings() {
	return {
		aggregateData: 'None',
		size: 0.5,
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
