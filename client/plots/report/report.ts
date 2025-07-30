import { getCompInit, copyMerge } from '../../rx/index.js'
import { fillTermWrapper } from '#termsetting'
import { ReportView } from './view/reportView'
import { RxComponentInner } from '../../types/rx.d'
import { controlsInit } from '../controls.js'
import { getCategoricalTermFilter } from '#filter'

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
		const state = this.getState(appState)
		for (const section of state.config.sections) {
			const div = this.view.dom.plotsDiv.append('div')

			const headerIcon = div.append('span').style('margin-right', '10px').style('cursor', 'pointer').text('▼') //icon to toggle the plots

			div
				.append('div')
				.style('display', 'inline-block')
				.style('font-size', '1.2em')
				.style('margin', '10px 0px')
				.style('font-weight', 'bold')
				.text(section.name) //header
			const sectionDiv = div
				.append('div')
				.style('margin', '10px')
				.style('display', 'flex')
				.style('flex-direction', 'row')
				.style('flex-wrap', 'wrap')
				.style('width', '100vw')
			headerIcon.on('click', () => {
				const display = sectionDiv.style('display')
				headerIcon.text(display === 'none' ? '▼' : '▲') //toggle the icon
				//toggle the display of the plot
				sectionDiv.style('display', display === 'none' ? 'flex' : 'none')
			})

			for (const plot of section.plots) {
				if (this.components.plots[plot.id]) continue
				await this.setPlot(plot, sectionDiv)
			}
		}
	}

	async replaceFilter() {
		const filter = this.getFilter() //read by child plots
		this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config: { filter, settings: { report: this.settings } } //update country and site in the report settings
		})
	}

	getFilter() {
		return getCategoricalTermFilter(this.config.filterTWs, this.settings, this.state.termdbConfig.authFilter)
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
		this.fillFilters()
	}

	async setPlot(plot, sectionDiv) {
		const plotDiv = sectionDiv.append('div').style('display', 'inline-block').style('margin', '10px')
		const headerDiv = plotDiv.append('div')
		const headerIcon = headerDiv.append('span').style('margin', '10px').style('cursor', 'pointer').text('▼') //icon to toggle the plots

		const header = headerDiv
			.append('div')
			.style('display', 'inline-block')
			.style('font-size', '1.1em')
			.style('margin-top', '10px')
		headerIcon.on('click', () => {
			const display = holder.style('display')
			headerIcon.text(display === 'none' ? '▼' : '▲') //toggle the icon
			//toggle the display of the plot
			holder.style('display', display === 'none' ? 'block' : 'none')
		})
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

	async fillFilters() {
		if (!this.config.filterTWs) {
			return
		}
		let index = 0
		for (const tw of this.config.filterTWs) {
			const filterValues = this.settings[tw.term.id] || ''
			const filters: any = {}
			for (const tw of this.config.filterTWs)
				filters[tw.term.id] = getCategoricalTermFilter(
					this.config.filterTWs,
					this.settings,
					tw,
					this.state.termfilter.filter
				)
			const data = await this.app.vocabApi.filterTermValues({
				terms: this.config.filterTWs,
				filters
			})
			const select = this.view.dom.filterSelects[index]
			select.selectAll('option').remove()

			for (const value of data[tw.term.id]) {
				if (value.label == '') continue //skip empty labels
				const option = select.append('option').attr('value', value.value).text(value.label)
				option.property('disabled', value.disabled)
				for (const filterValue of filterValues) {
					if (value.value === filterValue) {
						option.attr('selected', 'selected')
					}
				}
			}
			index++
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
		config.filter = app.vocabApi?.termdbConfig?.authFilter
		copyMerge(plot, config, opts)
		if (plot.filterTWs) for (const tw of plot.filterTWs) await fillTermWrapper(tw, app.vocabApi)

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
