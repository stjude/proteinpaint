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
import formatPlotData from './viewModel/plotData.ts'

class SCViewer extends PlotBase implements RxComponent {
	static type = 'sc'

	type: string
	components: { plots: { [key: string]: any } }
	dom: SCDom
	interactions?: SCInteractions
	items?: SingleCellSample[]
	itemColumns?: SampleColumn[]
	model?: SCModel
	segments: Segments
	view?: SCViewRenderer
	viewModel?: SCViewModel

	constructor(opts: SCViewerOpts, api: any) {
		super(opts, api)
		this.type = SCViewer.type
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
			loading: opts.holder
				.append('div')
				.attr('class', 'sjpp-sc-main-loading')
				.attr('data-testid', 'sjpp-sc-main-loading')
				.style('position', 'absolute')
				.style('top', '0')
				.style('left', '0')
				.style('width', '100%')
				.style('height', '100%')
				.style('background-color', 'rgba(255, 255, 255, 0.95)')
				.style('text-align', 'center'),
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
			throw new Error(
				`No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
			)
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
		this.model = new SCModel(this.app, this.id)
		try {
			/** Fetches the single cell sample data for the table */
			const response = await this.model.getSampleData()
			if (response.error || !response.samples || !response.samples.length) {
				this.app.printError('No samples found for this dataset')
				return
			}
			this.items = response.samples
			this.itemColumns = await this.model.getColumnLabels(dsScSamples)
		} catch (e: any) {
			if (e instanceof Error) console.error(`${e.message || e} [SC init()]`)
			else if (e.stack) console.log(e.stack)
			throw new Error(e.message || e)
		}
		this.interactions = new SCInteractions(this.app, this.dom, this.id, () => this.getState(this.app.getState()))
		//Init view model and view
		this.viewModel = new SCViewModel(this.app, state.config, this.items!, this.itemColumns)
		this.view = new SCViewRenderer(this.dom, this.interactions, this.segments)

		/** The item data and table rendering should only occur once
		 * .update() in main() handles changes to the buttons and plots */
		this.view.render(this.viewModel.tableData)
	}

	//TODO: .text() should be ds specific
	async initSegment(item, sampleId) {
		const caseText = item.case ? `Case: ${item.case}` : ''
		const itemText = `Sample: ${sampleId}` //item.cell, etc.
		const projectText = item['project id'] ? `Project: ${item['project id']}` : ''
		const headerText = [itemText, caseText, projectText].join(' ')

		this.segments[sampleId] = {
			title: this.dom.div
				.append('div')
				.attr('data-testid', `sjpp-sc-segment-title-${sampleId}`)
				.style('margin-left', '10px')
				.style('padding', '10px')
				.style('font-weight', 600)
				.text(headerText),
			subplots: this.dom.div
				.append('div')
				.attr('data-testid', `sjpp-sc-segment-subplots-${sampleId}`)
				.style('margin-left', '10px'),
			sandboxes: {}
		}
	}

	/** The plot obj is already in state.plots[] but not rendered
	 * (see SCInteractions). This creates the component and renders the plot */
	async initSubplotComponent(subplot: any, sampleId) {
		const sandbox = newSandboxDiv(this.segments[sampleId].subplots as any, {
			close: () => {
				//Delete the component before calling dispatch
				//Prevents main attempting to re-init the component
				delete this.components.plots[subplot.id]
				delete this.segments[sampleId].sandboxes[subplot.id]
				this.app.dispatch({
					type: 'plot_delete',
					id: subplot.id,
					parentId: this.id
				})
				//Could do this in main() but this is more performant
				this.view?.removeSegments()
			},
			plotId: subplot.id,
			beforePlotId: subplot.insertBefore || null
			// style: {
			// 	width: '98.5%'
			// }
		})

		const opts = Object.assign({}, subplot, {
			app: this.app,
			parentId: this.id,
			id: subplot.id
		})
		/** Summary is expecting entire sandbox object. Most other plots
		 * expect the header and the holder (i.e. body).*/
		if (subplot.chartType == 'summary') {
			opts.holder = sandbox
		} else {
			opts.holder = sandbox.body
			opts.header = sandbox.header
		}
		const { componentInit } = await importPlot(opts.chartType)
		this.components.plots[subplot.id] = await componentInit(opts)
		this.segments[sampleId].sandboxes[subplot.id] = sandbox.app_div
	}

	private async reconcileSubplots(state: SCFormattedState) {
		const subplotsById = new Map(state.subplots.map(subplot => [subplot.id, subplot]))
		for (const [subplotId, subplot] of subplotsById) {
			//TODO: Get rid of passing scItem
			const item = subplot.scItem || subplot?.term?.term?.sample
			if (!item) throw new Error('No item found for subplot. Expected subplot.scItem or config.settings.sc.item')
			const sampleId = item.sample || item.sID
			if (!this.segments[sampleId]) this.initSegment(item, sampleId)
			if (!this.components.plots[subplotId]) await this.initSubplotComponent(subplot, sampleId)
		}

		/** Instances like init'ing another plot from a transient plot (e.g.
		 * dictionary to summary) may not delete the sandbox DOM element immediately.
		 * This is a clean up for those instances */
		for (const subplotId of Object.keys(this.components.plots)) {
			if (!subplotsById.has(subplotId)) {
				// Find and remove the sandbox DOM element
				for (const segment of Object.values(this.segments)) {
					const sandbox = segment.sandboxes[subplotId]
					if (sandbox) {
						sandbox.remove()
						delete segment.sandboxes[subplotId]
						break
					}
				}
				delete this.components.plots[subplotId]
			}
		}

		this.view?.removeSegments()
	}

	async main() {
		const state = structuredClone(this.state) as SCFormattedState
		const config = state.config

		if (!this.model) throw new Error(`Model not initialized`)
		if (!this.viewModel) throw new Error(`ViewModel not initialized`)
		if (!this.view) throw new Error(`View not initialized`)
		if (!this.interactions) throw new Error(`Interactions not initialized`)

		this.interactions.toggleLoading(true)
		await this.reconcileSubplots(state)

		let data: any = null
		if (config.settings.sc.item) {
			try {
				data = await this.model.getData()
				if (data.error || !data.plots || !data.plots.length) {
					this.interactions.toggleLoading(false)
					this.app.printError(data.error)
					return
				}
			} catch (e: any) {
				this.interactions.toggleLoading(false)
				if (e instanceof Error) console.error(`${e.message || e} [SC main()]`)
				else if (e.stack) console.log(e.stack)
				throw new Error(e.message || e)
			}
			data.plots = formatPlotData(data.plots)
		}
		this.view.update(config.settings, data)
		this.interactions.toggleLoading(false)
	}
}

export const SCInit = getCompInit(SCViewer)
export const componentInit = SCInit

export function getPlotConfig(opts: SCConfigOpts, app: MassAppApi) {
	const config = {
		chartType: 'sc',
		hidePlotFilter: true,
		settings: getDefaultSCAppSettings(opts.overrides, app)
	} as any

	return copyMerge(config, opts)
}
