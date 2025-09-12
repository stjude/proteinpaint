import type { BasePlotConfig, MassAppActions, MassState } from '#mass/types/mass'
import type { SCConfigOpts, SCDom, SCState, SCViewerOpts, SampleColumn } from './SCTypes'
import type { SingleCellSample } from '#types'
import { RxComponent } from '../../types/rx.d'
import { getCompInit, copyMerge } from '#rx'
import { SCModel } from './model/SCModel'
import { SCViewModel } from './viewModel/SCViewModel'
import { SCView } from './view/SCView'
import { SCInteractions } from './interactions/SCInteractions'

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

class SCViewer extends RxComponent {
	readonly type = 'sc'
	components: {
		plots: { [key: string]: any }
	}
	dom: SCDom
	interactions?: SCInteractions
	samples?: SingleCellSample[]
	sampleColumns?: SampleColumn[]
	view?: SCView
	viewModel?: SCViewModel

	constructor(opts: SCViewerOpts) {
		super()
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
			plotBtnsDiv: div.append('div').attr('id', 'sjpp-sc-chart-buttons').style('display', 'none'),
			plotsDiv: div.append('div').attr('id', 'sjpp-sc-plots')
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
			termfilter: appState.termfilter,
			termdbConfig: appState.termdbConfig,
			vocab: appState.vocab
		}
	}

	reactsTo(action: MassAppActions) {
		if (action.type.includes('cache_termq')) return true
		if (action.type.startsWith('plot_')) {
			return action.id === this.id
		}
		if (action.type.startsWith('filter')) return true
		if (action.type.startsWith('cohort')) return true
		if (action.type == 'app_refresh') return true
	}

	/** The sample data and table rendering should only occur once */
	async init(appState: MassState) {
		const state = this.getState(appState) as SCState
		/** ds defines defaults in termdbConfig.queries.singleCell
		 * see Dataset type when resuming development*/
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
		this.interactions = new SCInteractions(this.app, this.id)
		//Init view model and view
		this.viewModel = new SCViewModel(this.app, state.config, this.samples!, this.sampleColumns)
		//Renders the static select btn and table
		this.view = new SCView(this.interactions, this.dom, this.viewModel.tableData)
	}

	/******* Code is a hold over from original design. *******
	 * Eventual refactor will manage subplots in the dashboard. */

	// async setComponent(config: SCConfig) {
	// 	this.plotsDiv[config.childType] = this.dom.plots.append('div')

	// 	const opts = {
	// 		app: this.app,
	// 		holder: this.plotsDiv[config.childType],
	// 		id: this.id,
	// 		parent: this.api
	// 	}
	// 	this.components.plots[config.childType] = await _.componentInit(opts)
	// }

	async main() {
		const config = structuredClone(this.state.config)
		if (config.chartType != this.type) return

		if (!this.view) throw `View not initialized [SC main()]`

		/******* Code below is a hold over from original design.*******
		 * Will need to implement something similar for the subplots
		 * when development resumes.*/

		// if (!this.components.plots[config.childType]) await this.setComponent(config)

		// for (const childType in this.components.plots) {
		// 	const chart = this.components.plots[childType]
		// 	if (chart.type != config.childType) {
		// 		this.plotsDiv[chart.type].style('display', 'none')
		// 	}
		// }
		// this.plotsDiv[config.childType].style('display', '')

		// this.view.update(config)
	}
}

export const SCInit = getCompInit(SCViewer)
export const componentInit = SCInit

export function getDefaultSCSettings(overrides = {}) {
	const defaults = {
		columns: {
			sample: 'Sample'
		}
	}
	return Object.assign(defaults, overrides)
}

export function getPlotConfig(opts: SCConfigOpts) {
	const config = {
		chartType: 'sc',
		subplots: [],
		settings: {
			sc: getDefaultSCSettings(opts.overrides || {})
		}
	} as any

	return copyMerge(config, opts)
}
