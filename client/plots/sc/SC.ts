import type { BasePlotConfig, MassAppApi, MassState } from '#mass/types/mass'
import type { SCConfigOpts, SCDom, SCFormattedState, SCViewerOpts, SampleColumn, Segments } from './SCTypes'
import type { SingleCellSample } from '#types'
import { PlotBase } from '../PlotBase.ts'
import { getCompInit, copyMerge, type RxComponent } from '#rx'
import { SCModel } from './model/SCModel'
import { SCViewModel } from './viewModel/SCViewModel'
import { SCInteractions } from './interactions/SCInteractions'
import { SCViewRenderer } from './view/SCViewRenderer'
import { getDefaultSCAppSettings } from './defaults'
import { importPlot } from '#plots/importPlot.js'
import { newSandboxDiv } from '#dom'

/** Overall app TODOs:
 *  - Plot buttons
 *  	- Implement additional menus to appear on click
 *  - Fix any outdated properties in the dataset queries.singleCell obj
 *  - Type all files
 *  - instead of using 'sample', change to 'key' or 'item' or something
 */

class SCViewer extends PlotBase implements RxComponent {
	readonly type = 'sc'
	components: { plots: { [key: string]: any } }
	dom: SCDom
	interactions?: SCInteractions
	items?: SingleCellSample[]
	itemColumns?: SampleColumn[]
	segments: Segments
	view?: SCViewRenderer
	viewModel?: SCViewModel

	constructor(opts: SCViewerOpts, api: any) {
		super(opts, api)
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
			tableDiv: div.append('div').attr('id', 'sjpp-sc-item-table'),
			plotsBtnsDiv: div.append('div').attr('id', 'sjpp-sc-plot-buttons').style('display', 'none')
		}

		this.segments = {}

		//opts.header is the sandbox header
		if (opts.header) opts.header.html(`SINGLE CELL`).style('font-size', '0.9em')
	}

	getState(appState: any): SCFormattedState {
		const config = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)? [SC getState()]`
		}
		return {
			config,
			subplots: appState.plots.filter(p => p.parentId === this.id),
			termfilter: appState.termfilter,
			termdbConfig: appState.termdbConfig,
			vocab: appState.vocab
		}
	}

	async init(appState: MassState) {
		const state = this.getState(appState) as SCFormattedState
		/** ds defines defaults in termdbConfig.queries.singleCell
		 * see Dataset type when resuming development */
		const dsScSamples = state.termdbConfig.queries?.singleCell?.samples
		const model = new SCModel(this.app)
		try {
			/** Fetches the single cell sample data for the table */
			const response = await model.getSampleData()
			if (response.error || !response.samples || !response.samples.length) {
				this.app.printError('No samples found for this dataset')
				return
			}
			this.items = response.samples
			this.itemColumns = await model.getColumnLabels(dsScSamples)
		} catch (e: any) {
			if (e instanceof Error) console.error(`${e.message || e} [SC init()]`)
			else if (e.stack) console.log(e.stack)
			throw `${e.message || e} [SC init()]`
		}
		this.interactions = new SCInteractions(this.app, this.dom, this.id)
		//Init view model and view
		this.viewModel = new SCViewModel(this.app, state.config, this.items!, this.itemColumns)
		this.view = new SCViewRenderer(this.dom, this.interactions, this.segments)

		/** The item data and table rendering should only occur once
		 * .update() in main() handles changes to the buttons and plots */
		this.view.render(this.viewModel.tableData)
	}

	//TODO: .text() should be ds specific
	async initSegment(item) {
		const caseText = item.case ? `Case: ${item.case}` : ''
		const itemText = item.sample ? `Sample: ${item.sample}` : '' //item.cell, etc.
		const projectText = item['project id'] ? `Project: ${item['project id']}` : ''
		const headerText = [itemText, caseText, projectText].join(' ')

		this.segments[item.sample] = {
			title: this.dom.div
				.append('div')
				.style('margin-left', '10px')
				.style('padding', '10px')
				.style('font-weight', 600)
				.text(headerText),
			subplots: this.dom.div.append('div').style('margin-left', '10px')
		}
	}

	/** The plot obj is already in state.plots[] but not rendered
	 * (see SCInteractions). This creates the component and renders the plot */
	async initSubplotComponent(subplot: any) {
		const sandbox = newSandboxDiv(this.segments[subplot.scItem.sample].subplots as any, {
			close: () => {
				//Delete the component before calling dispatch
				//Prevents main attempting to re-init the component
				delete this.components.plots[subplot.id]
				this.app.dispatch({
					type: 'plot_delete',
					id: subplot.id,
					parentId: this.id
				})
				//Could do this in main() but this is more performant
				this.view?.removeSegments()
			},
			plotId: subplot.id,
			// beforePlotId: plot.insertBefore || null,
			style: {
				//TODO: What width is appropriate here? 50%?
				width: '98.5%'
			}
		})

		const opts = Object.assign({}, subplot, {
			app: this.app,
			holder: sandbox.body,
			header: sandbox.header,
			parentId: this.id,
			id: subplot.id
		})
		const { componentInit } = await importPlot(opts.chartType)
		this.components.plots[subplot.id] = await componentInit(opts)
	}

	async main() {
		const state = this.getState(this.app.getState()) as SCFormattedState
		const config = state.config
		if (config.chartType != this.type) return

		if (!this.interactions) throw `Interactions not initialized [SC main()]`
		if (!this.view) throw `View not initialized [SC main()]`

		// const errors = {} collect plot init errors
		for (const subplot of state.subplots) {
			if (!this.segments[subplot.scItem.sample]) this.initSegment(subplot.scItem)
			if (!this.components.plots[subplot.id]) await this.initSubplotComponent(subplot)
		}
		this.view.update(config.settings)
	}
}

export const SCInit = getCompInit(SCViewer)
export const componentInit = SCInit

export function getPlotConfig(opts: SCConfigOpts, app: MassAppApi) {
	const config = {
		chartType: 'sc',
		settings: getDefaultSCAppSettings(opts.overrides || {}, app)
	} as any

	return copyMerge(config, opts)
}
