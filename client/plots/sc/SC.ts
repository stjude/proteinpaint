import type { BasePlotConfig, MassAppApi, MassState } from '#mass/types/mass'
import type { SCConfigOpts, SCDom, SCFormattedState, SCViewerOpts, SampleColumn } from './SCTypes'
import type { SingleCellSample } from '#types'
import { PlotBase } from '../PlotBase.ts'
import { getCompInit, copyMerge, type RxComponent } from '#rx'
import { SCModel } from './model/SCModel'
import { SCViewModel } from './viewModel/SCViewModel'
import { SCInteractions } from './interactions/SCInteractions'
import { SCViewRenderer } from './view/SCViewRenderer'
import { getDefaultSCAppSettings } from './defaults'
import { importPlot } from '#plots/importPlot.js'
import formatPlotData from './viewModel/plotData.ts'

export class SCViewer extends PlotBase implements RxComponent {
	static type = 'sc'

	type: string
	components: { plots: { [key: string]: any } }
	dom: SCDom
	interactions!: SCInteractions
	items!: SingleCellSample[]
	itemColumns!: SampleColumn[]
	model!: SCModel
	view!: SCViewRenderer
	viewModel!: SCViewModel

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
			plotsBtnsDiv: div.append('div').attr('id', 'sjpp-sc-plot-buttons').style('display', 'none'),
			sectionsDiv: div.append('div').attr('id', 'sjpp-sc-sections')
		}

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
		this.viewModel = new SCViewModel(this.app, state.config, this.items!, this.itemColumns)
		this.view = new SCViewRenderer(this)

		/** The item data and table rendering should only occur once
		 * .update() in main() handles changes to the buttons and plots */
		this.view.render(this.viewModel.tableData)
	}

	async main() {
		const state = structuredClone(this.state) as SCFormattedState
		const config = state.config

		if (!this.model) throw new Error(`Model not initialized`)
		if (!this.viewModel) throw new Error(`ViewModel not initialized`)
		if (!this.view) throw new Error(`View not initialized`)
		if (!this.interactions) throw new Error(`Interactions not initialized`)

		this.interactions.toggleLoading(true)

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
		await this.view.update(config.settings, data, state.subplots)
		this.interactions.toggleLoading(false)
	}

	async initPlotComponent(subplotId, opts) {
		const { componentInit } = await importPlot(opts.chartType)
		this.components.plots[subplotId] = await componentInit(opts)
	}

	removeComponent(subplotId) {
		this.components.plots[subplotId].destroy()
		delete this.components.plots[subplotId]
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
