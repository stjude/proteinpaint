import type { BasePlotConfig, MassAppApi, MassState } from '#mass/types/mass'
import type { SCConfigOpts, SCDom, SCFormattedState, SCViewerOpts, SampleColumn } from './SCTypes'
import type { SingleCellSample } from '#types'
import { PlotBase } from '../PlotBase.ts'
import { getCompInit, copyMerge, type RxComponent } from '#rx'
import { SCModel } from './model/SCModel'
import { SCViewModel } from './viewModel/SCViewModel'
import { SCInteractions } from './interactions/SCInteractions'
import { SCViewRenderer } from './view/SCViewRenderer'
import { getDefaultSCAppSettings } from './settings/defaults.ts'
import { getCombinedTermFilter } from '#filter'
import { SubplotManager } from './subplots/SubplotManager.ts'

/** Viewer for single cell data. Renders a sample table and associated subplots for each sample.*/
export class SCViewer extends PlotBase implements RxComponent {
	static type = 'sc'

	type: string
	components: { plots: { [key: string]: any } }
	dom: SCDom
	interactions!: SCInteractions
	items!: SingleCellSample[]
	itemColumns!: SampleColumn[]
	model!: SCModel
	subplotManager!: SubplotManager
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
			controlsDiv: div.append('div').attr('id', 'sjpp-sc-controls-btn'),
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
		const termfilter = getCombinedTermFilter(appState, config.filter)

		return {
			config,
			subplots: appState.plots.filter(p => p.parentId === this.id),
			termfilter,
			termdbConfig: appState.termdbConfig,
			vocab: appState.vocab
		}
	}

	async init(appState: MassState) {
		const state = this.getState(appState) as SCFormattedState
		/** ds defines defaults in termdbConfig.queries.singleCell
		 * see Dataset type when resuming development */
		const dsScSamples = state.termdbConfig.queries?.singleCell?.samples
		this.model = new SCModel(this)
		try {
			this.itemColumns = await this.model.getColumnLabels(dsScSamples)
		} catch (e: any) {
			if (e instanceof Error) console.error(`${e.message || e} [SC init()]`)
			else if (e.stack) console.log(e.stack)
			throw new Error(e.message || e)
		}
		this.viewModel = new SCViewModel(this.app, this.itemColumns)
		this.interactions = new SCInteractions(this)
		this.subplotManager = new SubplotManager(this)
		this.view = new SCViewRenderer(this)
		/** Only renders the controls above the table */
		this.view.render(state.config.settings.sc, state)
	}

	async main() {
		if (!this.model) throw new Error(`Model not initialized`)
		if (!this.viewModel) throw new Error(`ViewModel not initialized`)
		if (!this.view) throw new Error(`View not initialized`)
		if (!this.interactions) throw new Error(`Interactions not initialized`)

		const state = structuredClone(this.state) as SCFormattedState
		const config = state.config

		super.toggleLoadingDiv()

		let data: any
		try {
			const allSampleData = await this.model.getAllSampleData(state)
			if (!allSampleData || allSampleData.error) {
				super.toggleLoadingDiv('none')
				super.printError(allSampleData?.error || 'No samples found for this dataset')
				return
			}
			this.items = allSampleData.samples

			this.viewModel.processData(config, allSampleData.samples)

			if (config.settings?.sc?.item) {
				const sampleData = await this.model.getSampleData()
				if (!sampleData || sampleData.error) {
					super.toggleLoadingDiv('none')
					super.printError(sampleData?.error || 'No data found for this sample')
					return
				}
				data = sampleData
			}
		} catch (e: any) {
			if (e instanceof Error) console.error(`${e.message || e} [SC main()]`)
			else if (e.stack) console.log(e.stack)
			super.toggleLoadingDiv('none')
			super.printError(e.message || e)
			return
		}
		const activeSubplots = this.subplotManager.map(state.subplots)
		await this.view.update(config.settings, data, activeSubplots, this.viewModel.tableData, this.subplotManager)
		super.toggleLoadingDiv('none')
	}
}

export const SCInit = getCompInit(SCViewer)
export const componentInit = SCInit

export function getPlotConfig(opts: SCConfigOpts, app: MassAppApi) {
	const config = {
		chartType: 'sc',
		settings: getDefaultSCAppSettings(opts.overrides, app)
	} as any

	return copyMerge(config, opts)
}
