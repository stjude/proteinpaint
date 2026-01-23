import { PlotBase } from '#plots/PlotBase.ts'
import { getCompInit, copyMerge, type RxComponent } from '#rx'
import { dofetch3 } from '#common/dofetch'
import { select2Terms } from '#dom/select2Terms'
import { RunChart2Model } from './model/RunChart2Model.ts'
import { RunChart2View } from './view/RunChart2View.ts'
import { RunChart2ViewModel } from './viewmodel/RunChart2ViewModel.ts'
import { controlsInit } from '../controls.js'

class RunChart2 extends PlotBase implements RxComponent {
	static type = 'runChart2'
	type: string
	components: { controls: any }
	model!: RunChart2Model
	view!: RunChart2View
	vm!: RunChart2ViewModel
	settings: any
	config: any

	configTermKeys = ['term', 'term2']

	constructor(opts: any, api: any) {
		super(opts, api)
		this.opts = opts
		this.api = api
		this.type = RunChart2.type
		this.components = {
			controls: {}
		}
		if (opts.holder) {
			this.dom.holder = opts.holder
		}
	}

	async init(appState: any) {
		const state: any = this.getState(appState)
		this.config = structuredClone(state.config)
		this.settings = this.config.settings?.[this.type] || {}
		this.view = new RunChart2View(this)
		this.model = new RunChart2Model(this)
		this.vm = new RunChart2ViewModel(this)
	}

	reactsTo(action) {
		if (action.type.includes('cache_termq')) return true
		if (action.type.startsWith('filter')) return true
		if (action.type.startsWith('cohort')) return true
		if (action.type == 'app_refresh') return true
		if (action.type.startsWith('plot_')) {
			return (
				(action.id === this.id || action.id == this.parentId) &&
				(!action.config?.childType || action.config?.childType == this.type)
			)
		}
	}

	//Need to implement init() here
	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		this.state = { config }
		return { config }
	}

	async main() {
		this.config = structuredClone(this.state.config)
		this.settings = this.config.settings?.[this.type] || {}

		// Show loading
		this.view.dom.loadingDiv.style('display', 'block')

		try {
			await this.model.initData()
			this.model.processData()
			await this.setControls()
			this.vm.render()
			this.view.dom.loadingDiv.style('display', 'none')
		} catch (error: any) {
			this.view.dom.loadingDiv.style('display', 'none')
			this.view.dom.errorDiv.style('display', 'block').text(`Error: ${error.message || error}`)
			console.error('RunChart2 error:', error)
		}
	}

	async fetchData(requestArg: any) {
		const result = await dofetch3('termdb/runChart', { body: requestArg })
		if (result.error) {
			throw new Error(result.error)
		}
		return result
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
	}

	async getRequestArg() {
		const config = await this.getMutableConfig()
		const reqArg: any = {
			genome: this.app.vocabApi.vocab.genome,
			dslabel: this.app.vocabApi.vocab.dslabel,
			term: config.term,
			term2: config.term2,
			aggregation: this.settings.aggregation || config.aggregation || 'mean'
		}
		return reqArg
	}
}

export const runChart2Init = getCompInit(RunChart2)
export const componentInit = runChart2Init

export function makeChartBtnMenu(holder, chartsInstance) {
	/*
	holder: the holder in the tooltip
	chartsInstance: MassCharts instance
		termdbConfig is accessible at chartsInstance.state.termdbConfig{}
		mass option is accessible at chartsInstance.app.opts{}
	*/
	const menuDiv = holder.append('div')
	menuDiv
		.append('button')
		.style('margin', '5px')
		.style('padding', '10px 15px')
		.style('border-radius', '20px')
		.style('border-color', '#ededed')
		.style('display', 'block')
		.text('Select data to plot ...')
		.on('click', () => {
			chartsInstance.dom.tip.clear()
			select2Terms(chartsInstance.dom.tip, chartsInstance.app, 'runChart2', 'date', callback, 'numeric')
			chartsInstance.dom.tip.show() //re-show the tip after it was cleared
		})

	// Add buttons for any pre-configured runChart2 plots
	for (const plot of chartsInstance.state.termdbConfig?.plotConfigByCohort?.default?.runChart2?.plots || []) {
		const config = structuredClone(plot)
		console.log('Adding runChart2 plot button for', config)
		menuDiv
			.append('button')
			.style('margin', '5px')
			.style('padding', '10px 15px')
			.style('border-radius', '20px')
			.style('border-color', '#ededed')
			.style('display', 'block')
			.text(plot.name)
			.on('click', () => {
				chartsInstance.app.dispatch({
					type: 'plot_create',
					config: {
						chartType: 'runChart2',
						...config
					}
				})
				chartsInstance.dom.tip.hide()
			})
	}
	const callback = (xterm, yterm) => {
		chartsInstance.app.dispatch({
			type: 'plot_create',
			config: {
				chartType: 'runChart2',
				term: { term: xterm, q: { mode: 'continuous' } },
				term2: { term: yterm, q: { mode: 'continuous' } },
				name: `${xterm.name} vs ${yterm.name}`
			}
		})
	}
}

export function getDefaultRunChart2Settings() {
	return {
		aggregation: 'mean',
		svgw: 800,
		svgh: 400,
		defaultColor: '#1f77b4'
	}
}

export function getPlotConfig(opts) {
	if (!opts.term) throw 'opts.term missing' // for X axis
	if (!opts.term2) throw 'opts.term2 missing' // for Y axis

	const defaultConfig = opts.app?.vocabApi?.termdbConfig?.plotConfigByCohort?.default?.['runChart2']
	const settings = copyMerge(getDefaultRunChart2Settings(), defaultConfig?.settings)

	const config: any = {
		settings: {
			controls: {
				isOpen: false
			},
			runChart2: settings
		}
	}

	return copyMerge(config, defaultConfig, opts)
}
