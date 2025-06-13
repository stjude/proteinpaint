import { getCompInit, copyMerge } from '../../rx/index.js'
import { fillTermWrapper } from '#termsetting'
import { ReportView } from './view/reportView'
import { RxComponentInner } from '../../types/rx.d'
import { controlsInit } from '../controls.js'

export class Report extends RxComponentInner {
	config: any
	view!: ReportView
	components: any
	settings: any
	opts: any
	state!: any
	readonly type: string
	id!: string

	constructor() {
		super()
		this.type = 'report'
	}

	async init(appState) {
		this.config = appState.plots.find(p => p.id === this.id)
		this.view = new ReportView(this)
		this.components = { plots: {} }
	}

	getState(appState: any) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}

		return {
			config,
			plots: appState.plots.filter(p => p.parentId === this.id), //this property is needed to indicate that child plots need to be added to the appState plots
			termfilter: appState.termfilter,
			vocab: appState.vocab,
			termdbConfig: appState.termdbConfig
		}
	}

	async main() {
		this.config = structuredClone(this.state.config)
		this.settings = this.config.settings.report

		for (const plot of this.state.plots) {
			if (this.components.plots[plot.id]) continue
			await this.setPlot(plot)
		}
	}

	async setPlot(plot) {
		//console.log('report init plot', plot)
		const header = this.view.dom.mainDiv.append('div').style('font-size', '1.2em').style('font-weight', 'bold')
		const holder = this.view.dom.mainDiv.append('div')
		const opts = structuredClone(plot)
		opts.header = header
		opts.holder = holder
		opts.app = this.app
		opts.parentId = this.id
		opts.controls = this.view.dom.controlsHolder
		const { componentInit } = await import(`../../plots/${opts.chartType}.js`)
		this.components.plots[opts.id] = await componentInit(opts)
	}

	async setControls() {
		this.view.dom.controlsHolder.selectAll('*').remove()
		const inputs = this.view.getControlInputs()
		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: this.view.dom.controlsHolder,
				inputs
			})
		}
	}
}

export async function getPlotConfig(opts, app) {
	//if (!opts.colorTW) throw 'sampleScatter getPlotConfig: opts.colorTW{} missing'
	//if (!opts.name && !(opts.term && opts.term2)) throw 'sampleScatter getPlotConfig: missing coordinates input'

	const plot: any = {
		settings: {
			controls: {
				isOpen: false // control panel is hidden by default
			},
			Report: getDefaultReportSettings(),
			startColor: {}, //dict to store the start color of the gradient for each chart when using continuous color
			stopColor: {} //dict to store the stop color of the gradient for each chart when using continuous color
		}
	}

	try {
		const config = app.vocabApi?.termdbConfig?.plotConfigByCohort?.default?.report
		copyMerge(plot, config, opts)

		return plot
	} catch (e) {
		console.log(e)
		throw `${e} [sampleScatter getPlotConfig()]`
	}
}

export const reportInit = getCompInit(Report)
// this alias will allow abstracted dynamic imports
export const componentInit = reportInit

export async function makeChartBtnMenu(holder, chartsInstance) {
	const countryTW: any = { id: 'ISOcode' }
	await fillTermWrapper(countryTW, chartsInstance.app.vocabApi)

	const menuDiv = holder
		.append('div')
		.style('overflow', 'auto')
		.style('height', '400px')
		.attr('class', 'sjpp_show_scrollbar')
	menuDiv.append('div').style('padding', '5px').style('color', 'gray').text('Select country:')
	for (const value in countryTW.term.values) {
		const country = countryTW.term.values[value].label
		menuDiv
			.append('button')
			.style('margin', '5px')
			.style('padding', '10px 15px')
			.style('border-radius', '20px')
			.style('border-color', '#ededed')
			.style('display', 'block')
			.text(country)
			.on('click', () => {
				chartsInstance.app.dispatch({
					type: 'plot_create',
					config: {
						chartType: 'report',
						country
					}
				})
				//window.open('summary.html?country=' + country, '_blank')
				chartsInstance.dom.tip.hide()
			})
	}
}

export function getDefaultReportSettings() {
	return {}
}
