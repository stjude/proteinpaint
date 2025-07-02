import { getCompInit, copyMerge } from '../../rx/index.js'
import { fillTermWrapper } from '#termsetting'
import { ReportView } from './view/reportView'
import { RxComponentInner } from '../../types/rx.d'
import { controlsInit } from '../controls.js'
import { getCategoricalTermFilter } from '#shared/filter.js'

export class Report extends RxComponentInner {
	config: any
	view!: ReportView
	components: any
	settings: any
	opts: any
	state!: any
	readonly type: string
	id!: string
	filterTWs: any[] = []

	constructor() {
		super()
		this.type = 'report'
	}

	async init(appState) {
		this.config = appState.plots.find(p => p.id === this.id)
		this.view = new ReportView(this)
		this.components = { plots: {} }
	}

	async replaceFilter() {
		this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config: { filter: this.getFilter(), settings: { report: this.settings } } //update country and site in the report settings
		})
	}

	getFilter() {
		return getCategoricalTermFilter(this.filterTWs, this.settings, null, this.state.termfilter.filter)
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
		//Though the plots are read from the dataset and do not change in the future they may be added dynamically so we keep this loop here
		for (const section of this.state.config.sections) {
			const sectionDiv = this.view.dom.plotsDiv.append('div')

			sectionDiv.append('div').style('font-size', '1.2em').style('font-weight', 'bold').text(section.name)
			const plotDiv = sectionDiv.append('div').style('margin', '20px')

			for (const plot of section.plots) {
				if (this.components.plots[plot.id]) continue
				await this.setPlot(plot, plotDiv)
			}
		}
		this.fillSites()
	}

	async setPlot(plot, plotDiv) {
		const header = plotDiv.append('div')
		const holder = plotDiv.append('div')
		const opts = structuredClone(plot)
		opts.header = header
		opts.holder = holder
		opts.app = this.app
		opts.parentId = this.id
		//opts.controls = this.view.dom.controlsHolder
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

	async fillSites() {
		const site = this.settings[this.config.siteTW.term.id] || ''
		this.filterTWs = [this.config.countryTW, this.config.siteTW]
		const filters: any = {}
		for (const tw of this.filterTWs)
			filters[tw.term.id] = getCategoricalTermFilter(this.filterTWs, this.settings, tw, this.state.termfilter.filter)
		const sitesData = await this.app.vocabApi.filterTermValues({
			terms: this.filterTWs,
			filters
		})
		const siteSelect = this.view.dom.siteSelect
		siteSelect.selectAll('option').remove()

		for (const siteOption of sitesData[this.config.siteTW.term.id]) {
			const option = siteSelect.append('option').attr('value', siteOption.value).text(siteOption.label)
			option.property('disabled', siteOption.disabled)
			if (siteOption.value === site) {
				option.attr('selected', 'selected')
			}
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
			report: getDefaultReportSettings(),
			startColor: {}, //dict to store the start color of the gradient for each chart when using continuous color
			stopColor: {} //dict to store the stop color of the gradient for each chart when using continuous color
		}
	}

	try {
		const config = app.vocabApi?.termdbConfig?.plotConfigByCohort?.default?.report
		copyMerge(plot, config, opts)
		if (plot.countryTW) await fillTermWrapper(plot.countryTW, app.vocabApi)
		if (plot.siteTW) await fillTermWrapper(plot.siteTW, app.vocabApi)
		return plot
	} catch (e) {
		console.log(e)
		throw `${e} [sampleScatter getPlotConfig()]`
	}
}

export const reportInit = getCompInit(Report)
// this alias will allow abstracted dynamic imports
export const componentInit = reportInit

export function getDefaultReportSettings() {
	return {}
}
