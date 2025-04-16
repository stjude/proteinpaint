import { RxComponentInner } from '../../types/rx.d'
import type { BasePlotConfig, MassAppActions, MassState } from '#mass/types/mass'
import { getCompInit, copyMerge } from '#rx'
import type { SCConfigOpts, SCDom, SCState, SCViewerOpts } from './SCTypes'
import type { Sample } from '#types'
import { SCModel } from './model/SCModel'
import { SCViewModel } from './viewModel/SCViewModel'
import { SCView } from './view/SCView'
import { SCInteractions } from './interactions/SCInteractions'

/** TODO
 * - Type file
 * - Add comments/documentation
 */
class SCViewer extends RxComponentInner {
	readonly type = 'sc'
	components: {
		plots: { [key: string]: any }
	}
	dom: SCDom
	interactions?: SCInteractions
	samples?: Sample[]
	/** Slightly modified from termdbConfig.queries.singleCell.samples.sampleColumns */
	sampleColumns?: { termid: string; label: string }[]
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

	async init(appState: MassState) {
		const state = this.getState(appState) as SCState
		const dsScSamples = state.termdbConfig.queries?.singleCell?.samples
		const model = new SCModel(this.app)
		try {
			const response = await model.getSampleData()
			if (response.error || !response.samples || !response.samples.length) {
				this.app.printError('No samples found for this dataset')
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
		this.viewModel = new SCViewModel(this.app, state.config, this.samples, this.sampleColumns)
		//Renders the static select btn and table
		this.view = new SCView(this.interactions, this.dom, this.viewModel.tableData)
	}

	// async setComponent(config: SCConfig) {
	// 	/** Will manage all the subplots */

	// 	// let _
	// 	// if (config.childType == 'scSampleTable') _ = await import(`#plots/scSampleTable.ts`)

	// 	// this.plotsDiv[config.childType] = this.dom.plots.append('div')

	// 	// const opts = {
	// 	// 	app: this.app,
	// 	// 	holder: this.plotsDiv[config.childType],
	// 	// 	id: this.id,
	// 	// 	parent: this.api
	// 	// }
	// 	// this.components.plots[config.childType] = await _.componentInit(opts)
	// }

	async main() {
		const config = structuredClone(this.state.config)
		if (config.chartType != this.type) return

		if (!this.view) throw `View not initialized [SC main()]`

		/**Will manage the subplots in the dashboard */

		// if (!this.components.plots[config.childType]) await this.setComponent(config)

		// for (const childType in this.components.plots) {
		// 	const chart = this.components.plots[childType]
		// 	if (chart.type != config.childType) {
		// 		this.plotsDiv[chart.type].style('display', 'none')
		// 	}
		// }
		// this.plotsDiv[config.childType].style('display', '')

		// this.renderer.update(config)
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
