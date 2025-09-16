import type { BasePlotConfig, MassState } from '#mass/types/mass'
import type { SCConfigOpts, SCDom, SCState, SCViewerOpts, SampleColumn } from './SCTypes'
import type { SingleCellSample } from '#types'
import { PlotBase } from '../PlotBase.ts'
import { getCompInit, copyMerge, type RxComponent } from '#rx'
import { SCModel } from './model/SCModel'
import { SCViewModel } from './viewModel/SCViewModel'
import { SCInteractions } from './interactions/SCInteractions'
import { SCViewRenderer } from './view/SCViewRenderer'
import { importPlot } from '#plots/importPlot.js'

/** App in development. Project being set aside for awhile
 *
 * App TODOs:
 *  - Implement plot buttons
 *  	- Either return list of available data or create a route
 *  	- Implement additional menus to appear on click
 *  - Implement multi plot rendering
 *  	- Create sections by sample and render plots in each section
 * 		- Develop containers to hold plots with destroy methods and
 * 			possibly other animation methods
 */

class SCViewer extends PlotBase implements RxComponent {
	readonly type = 'sc'
	components: {
		plots: { [key: string]: any }
	}
	dom: SCDom
	interactions?: SCInteractions
	samples?: SingleCellSample[]
	sampleColumns?: SampleColumn[]
	view?: SCViewRenderer
	viewModel?: SCViewModel

	constructor(opts: SCViewerOpts) {
		super(opts)
		this.components = {
			plots: {}
		}
		const div = opts.holder
			.classed('sjpp-sc-main', true)
			.append('div')
			.style('padding', '5px')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')

		this.dom = {
			div,
			selectBtnDiv: div.append('div').attr('id', 'sjpp-sc-select-btn'),
			tableDiv: div.append('div').attr('id', 'sjpp-sc-sample-table'),
			chartBtnsDiv: div.append('div').attr('id', 'sjpp-sc-chart-buttons').style('display', 'none'),
			chartsDiv: div.append('div').attr('id', 'sjpp-sc-charts')
		}

		//opts.header is the sandbox header
		if (opts.header) opts.header.html(`SINGLE CELL`).style('font-size', '0.9em')
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config,
			subplots: appState.plots.filter(p => p.parentId === this.id),
			termfilter: appState.termfilter,
			termdbConfig: appState.termdbConfig,
			vocab: appState.vocab
		}
	}

	//Is this still necessary??
	reactsTo(action: any): boolean {
		if (action.type.includes('cache_termq')) return true
		if (action.type.startsWith('plot_')) return action.id === this.id || action.parentId === this.id
		if (action.type.startsWith('filter')) return true
		if (action.type.startsWith('cohort')) return true
		if (action.type == 'app_refresh') return true
		else return false
	}

	/** The sample data and table rendering should only occur once */
	async init(appState: MassState) {
		const state = this.getState(appState) as SCState
		/** ds defines defaults in termdbConfig.queries.singleCell
		 * see Dataset type when resuming development */
		const dsScSamples = state.termdbConfig.queries?.singleCell?.samples
		const model = new SCModel(this.app)
		try {
			/** Fetches the single cell sample data */
			const response = await model.getSampleData()
			if (response.error || !response.samples || !response.samples.length) {
				this.app.printError('No samples found for this dataset')
				return
			}
			this.samples = response.samples
			this.sampleColumns = await model.getColumnLabels(dsScSamples)
		} catch (e: any) {
			if (e instanceof Error) console.error(`${e.message || e} [SC init()]`)
			else if (e.stack) console.log(e.stack)
			throw `${e} [SC init()]`
		}
		this.interactions = new SCInteractions(this.app, this.dom, this.id)
		//Init view model and view
		this.viewModel = new SCViewModel(this.app, state.config, this.samples!, this.sampleColumns)

		this.view = new SCViewRenderer(this.dom, this.interactions)
		this.view.render(this.viewModel.tableData)
	}

	async initSubplot(plot) {
		const opts = Object.assign({}, plot, {
			app: this.app,
			holder: this.dom.chartsDiv.append('div'),
			parentId: this.id,
			id: plot.id
		})
		const { componentInit } = await importPlot(opts.chartType)
		this.components.plots[plot.id] = await componentInit(opts)
	}

	async main() {
		const state = this.getState(this.app.getState()) as SCState
		const config = state.config
		if (config.chartType != this.type) return

		if (!this.interactions) throw `Interactions not initialized [SC main()]`
		if (!this.view) throw `View not initialized [SC main()]`

		for (const plot of state.subplots) {
			if (!this.components.plots[plot.id]) await this.initSubplot(plot)
		}

		this.view.update(config.settings.sc)
	}
}

export const SCInit = getCompInit(SCViewer)
export const componentInit = SCInit

export function getDefaultSCSettings(overrides = {}) {
	const defaults = {
		columns: {
			sample: 'Sample'
		},
		sample: undefined
	}
	return Object.assign(defaults, overrides)
}

export function getPlotConfig(opts: SCConfigOpts) {
	const config = {
		chartType: 'sc',
		settings: {
			sc: getDefaultSCSettings(opts.overrides || {})
		}
	} as any

	return copyMerge(config, opts)
}
