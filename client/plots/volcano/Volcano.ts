import type { MassState, BasePlotConfig } from '#mass/types/mass'
import { getCompInit, copyMerge, type RxComponent, type AppApi } from '#rx'
import { PlotBase } from '../PlotBase'
import { fillTermWrapper } from '#termsetting'
import { Menu, sayerror } from '#dom'
import { controlsInit } from '../controls'
import { getDefaultVolcanoSettings, validateVolcanoSettings } from './settings/defaults'
import type { VolcanoOpts, VolcanoDom } from './VolcanoTypes'
import { VolcanoModel } from './model/VolcanoModel'
import { VolcanoViewModel } from './viewModel/VolcanoViewModel'
import { VolcanoInteractions } from './interactions/VolcanoInteractions'
import { VolcanoPlotView } from './view/VolcanoPlotView'
import { VolcanoControlInputs } from './VolcanoControlInputs'
import { getCombinedTermFilter } from '#filter'
import { GENE_EXPRESSION, SINGLECELL_CELLTYPE } from '#shared/terms.js'

class Volcano extends PlotBase implements RxComponent {
	static type = 'volcano'
	type: string
	components: { controls: any }
	dom: VolcanoDom
	interactions?: VolcanoInteractions
	model!: VolcanoModel
	view!: VolcanoPlotView
	termType: string

	constructor(opts: VolcanoOpts, api) {
		super(opts, api)
		if (this.opts.parentId) this.parentId = this.opts.parentId
		this.type = Volcano.type
		this.components = {
			controls: {}
		}

		this.termType = opts.termType
		const holder = opts.holder
			.classed('sjpp-volcano-main', true)
			.attr('data-testid', `sjpp-volcano-main-${opts.termType}`)
		//Either allow a node to be passed or create a new div
		const controls = typeof opts.controls == 'object' ? opts.controls : holder || (holder as any).append('div')
		const error = opts.holder
			.append('div')
			.attr('id', 'sjpp-volcano-error')
			.attr('data-testid', `sjpp-volcano-error-${opts.termType}`)
			.style('opacity', 0.75) as any
		this.dom = {
			holder,
			controls,
			error,
			wait: holder
				.append('div')
				.attr('id', 'sjpp-volcano-wait')
				.attr('data-testid', `sjpp-volcano-wait-${opts.termType}`)
				.style('opacity', 0.75)
				.style('padding', '20px')
				.text('Loading...') as any,
			tip: new Menu({ padding: '' }),
			actionsTip: new Menu({ padding: '' })
		}
	}

	getState(appState: MassState) {
		const config: any = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) {
			throw new Error(
				`No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
			)
		}
		const parentConfig: any = this.parentId && appState.plots.find(p => p.id === this.parentId)
		const termfilter = getCombinedTermFilter(appState, config.filter || parentConfig?.filter)

		return {
			config: Object.assign({}, config, {
				settings: {
					volcano: config.settings.volcano
				}
			}),
			termfilter
		}
	}

	async setControls() {
		const plotConfig = this.app.getState().plots.find((p: any) => p.id === this.id)
		const controls = new VolcanoControlInputs(plotConfig, this.termType)

		this.components.controls = await controlsInit({
			app: this.app,
			id: this.id,
			holder: this.dom.controls.style('display', 'inline-block'),
			inputs: controls.inputs
		})

		this.components.controls.on('downloadClick.volcano', () => this.interactions!.download(this.termType))
		if (plotConfig.chartType == 'differentialAnalysis')
			this.components.controls.on('helpClick.differentialAnalysis', () =>
				//Opens the page for the differential analysis wiki
				//Can't put in parent as DA does not have a controls component
				window.open('https://github.com/stjude/proteinpaint/wiki/Differential-analysis')
			)
	}

	async init() {
		this.interactions = new VolcanoInteractions(this.app, this.id, this.dom)
		this.model = new VolcanoModel(this.app, this.termType)
		this.view = new VolcanoPlotView(this.dom, this.interactions, this.termType)
		await this.setControls()
	}

	async main() {
		if (!this.interactions) throw new Error('Volcano Interactions not initialized')
		if (!this.model) throw new Error('Volcano Model not initialized')
		if (!this.view) throw new Error('Volcano View not initialized')

		const config = structuredClone(this.state.config)
		//TODO: Fix this to use parentId instead
		if (config.chartType != this.type && config.childType != this.type) return

		const settings = config.settings.volcano
		try {
			//Only show Loading for data requests that take longer than 500ms
			const showWait = setTimeout(() => {
				this.dom.wait.style('display', 'block')
			}, 500)

			/** Fetch data */
			const response = await this.model.getData(config, settings)
			if (!response || response.error || !response.data || !response.data.dots || !response.data.dots.length) {
				sayerror(this.dom.error, response?.error || 'No data returned from server')
				clearTimeout(showWait)
				this.dom.wait.style('display', 'none')
				return
			}

			/** Format response into an object for rendering */
			const viewModel = new VolcanoViewModel(config, response, settings)
			//Pass table data for downloading
			this.interactions.pValueTableData = viewModel.viewData.pValueTableData
			this.interactions.data = response.data.dots

			/** Render formatted data */
			this.view.render(settings, viewModel.viewData)

			clearTimeout(showWait)
			this.dom.wait.style('display', 'none')
		} catch (e: any) {
			if (e instanceof Error) console.error(e.message || e)
			else if (e.stack) console.log(e.stack)
			throw e
		}
	}
}

export const volcanoInit = getCompInit(Volcano)
export const componentInit = volcanoInit

export async function getPlotConfig(opts: any, app: AppApi) {
	if (!opts.termType) throw new Error('.termType is required')

	const config = {
		settings: {
			volcano: getDefaultVolcanoSettings(opts.overrides, opts)
		},
		highlightedData: opts.highlightedData || [],
		termType: opts.termType
	}

	//Define Gene Expression config
	if (opts.termType == GENE_EXPRESSION) {
		if (opts.confounderTws) {
			try {
				for (const tw of opts.confounderTws) {
					await fillTermWrapper(tw, app.vocabApi)
				}
			} catch (e: any) {
				console.error(e.message || e)
				throw new Error(`Volcano getPlotConfig() failed to fill confounder term wrappers: ${e}`)
			}
		}
		Object.assign(config, {
			confounderTws: opts.confounderTws || [],
			samplelst: opts.samplelst
		})
	}

	//Define Single Cell Cell Type config
	if (opts.termType == SINGLECELL_CELLTYPE) {
		Object.assign(config, {
			//TODO: Fix this logic
			sample: opts.experimentID || opts.sample || opts.samples?.[0]?.experiments[0]?.experimentID,
			termId: app.vocabApi.termdbConfig.queries.singleCell.DEgenes.termId,
			//TODO: 'Cluster' is a fallback for development
			//Should require opts.categoryName in the future
			categoryName: opts.categoryName || 'Cluster'
		})
	}

	//Validate user submitted unavailable/inappropriate settings
	validateVolcanoSettings(config, opts)

	return copyMerge(config, opts)
}
