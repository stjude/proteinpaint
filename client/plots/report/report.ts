import { getCompInit, copyMerge } from '../../rx/index.js'
import { fillTermWrapper } from '#termsetting'
import { ReportView } from './view/reportView'
import { RxComponentInner } from '../../types/rx.d'
import { controlsInit } from '../controls.js'
import { getTermFilter } from '#shared/filter.js'

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

	async replaceGlobalFilter() {
		const country = this.view.dom.countrySelect.node().value
		const site = this.view.dom.siteSelect.node().value
		const filter: any = {
			type: 'tvslst',
			in: true,
			join: '',
			lst: []
		}
		if (country) {
			filter.lst.push({
				type: 'tvs',
				tvs: {
					term: this.config.countryTW.term,
					values: [{ key: country }]
				}
			})
		}
		if (site) {
			filter.lst.push({
				type: 'tvs',
				tvs: {
					term: this.config.siteTW.term,
					values: [{ key: site }]
				}
			})
		}
		filter.tag = 'filterUiRoot'
		if (filter.lst.length > 1) filter.join = 'and'

		this.app.dispatch({
			type: 'app_refresh',
			subactions: [
				{
					type: 'filter_replace',
					filter
				},
				{
					type: 'plot_edit',
					id: this.id,
					config: { site, country }
				}
			]
		})
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
		this.fillSites()
	}

	async setPlot(plot) {
		const header = this.view.dom.plotsDiv.append('div').style('font-size', '1.2em').style('font-weight', 'bold')
		const holder = this.view.dom.plotsDiv.append('div')
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
		const country = this.state.config.country
		const site = this.state.config.site
		const terms = [this.config.countryTW, this.config.siteTW]

		const filters = { [this.config.countryTW.term.id]: this.state.termfilter.filter }
		const values = { [this.config.countryTW.term.id]: country }
		filters[this.config.siteTW.term.id] = getTermFilter(terms, values, this.config.siteTW, this.state.termfilter.filter)
		const sitesData = await this.app.vocabApi.filterTermValues({
			terms,
			filters
		})
		console.log('sitesData', sitesData)
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
			Report: getDefaultReportSettings(),
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
