import type { MassState, BasePlotConfig } from '#mass/types/mass'
import type { VolcanoSettings } from './DiffAnalysisTypes'
import { getCompInit, copyMerge } from '#rx'
import { Menu } from '#dom'
import { RxComponentInner } from '../../types/rx.d'
import { controlsInit } from '../controls'
import type { DiffAnalysisInteractions } from './interactions/DiffAnalysisInteractions'
import { VolcanoModel } from './model/VolcanoModel'
import { VolcanoViewModel } from './viewModel/VolcanoViewModel'
import { VolcanoInteractions } from './interactions/VolcanoInteractions'
import { VolcanoPlotView } from './view/VolcanoPlotView'
import { VolcanoControlInputs } from './VolcanoControlInputs'

/** TODO:
 * - Fix all the types */
class Volcano extends RxComponentInner {
	readonly type = 'volcano'
	components: { controls: any }
	dom: { holder: any; controls: any; error: any; wait: any; tip: any }
	interactions?: VolcanoInteractions
	termType: string //'geneExpresion', etc.
	diffAnalysisInteractions?: DiffAnalysisInteractions

	constructor(opts: any) {
		super()
		this.components = {
			controls: {}
		}
		this.termType = opts.termType
		const holder = opts.holder.classed('sjpp-diff-analysis-main', true)
		const controls = opts.controls || holder.append('div')
		const error = opts.holder.append('div').attr('id', 'sjpp-diff-analysis-error').style('opacity', 0.75)
		this.dom = {
			holder,
			controls,
			error,
			wait: holder
				.append('div')
				.attr('id', 'sjpp-diff-analysis-wait')
				.style('opacity', 0.75)
				.style('padding', '20px')
				.text('Loading...'),
			tip: new Menu({ padding: '' })
		}
		if (opts.diffAnalysisInteractions) this.diffAnalysisInteractions = opts.diffAnalysisInteractions
	}

	reactsTo(action) {
		if (action.type.includes('cache_termq')) return true
		if (action.type.startsWith('plot_')) {
			return action.id === this.id
		}
		if (action.type.startsWith('filter')) return true
		if (action.type.startsWith('cohort')) return true
		if (action.type == 'app_refresh') return true
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config: Object.assign({}, config, {
				settings: {
					volcano: config.settings.volcano
				}
			})
		}
	}

	async setControls() {
		const controls = new VolcanoControlInputs(this.termType)

		this.components.controls = await controlsInit({
			app: this.app,
			id: this.id,
			holder: this.dom.controls.attr('class', 'pp-termdb-plot-controls').style('display', 'inline-block'),
			inputs: controls.inputs
		})

		this.components.controls.on('downloadClick.differentialAnalysis', () => this.interactions!.download())
		this.components.controls.on('helpClick.differentialAnalysis', () =>
			window.open('https://github.com/stjude/proteinpaint/wiki/Differential-analysis')
		)
	}

	async init() {
		this.interactions = new VolcanoInteractions(this.app, this.id, this.dom)
		await this.setControls()
	}

	async main() {
		const config = structuredClone(this.state.config)
		if (config.chartType != this.type && config.childType != this.type) return

		try {
			if (!this.interactions) throw 'Interactions not initialized [main() Volcano.ts]'
			this.interactions.clearDom()
			this.dom.wait.style('display', 'block')
			const settings = config.settings.volcano
			/** Fetch data */
			const model = new VolcanoModel(this.app, config, settings)
			const response = await model.getData()
			if (!response || response.error || !response.data.length) {
				this.dom.error.text(response.error || 'No data returned from server')
			}
			if (this.diffAnalysisInteractions) this.diffAnalysisInteractions.setVar('volcanoResponse', response)

			/** Format response into an object for rendering */
			const viewModel = new VolcanoViewModel(config, response, settings)
			//Pass table data for downloading
			this.interactions.pValueTableData = viewModel.viewData.pValueTableData
			this.interactions.data = response.data
			this.dom.wait.style('display', 'none')
			/** Render formatted data */
			new VolcanoPlotView(this.dom, settings, viewModel.viewData, this.interactions)
		} catch (e: any) {
			if (e instanceof Error) console.error(e.message || e)
			else if (e.stack) console.log(e.stack)
			throw e
		}
	}
}

export const volcanoInit = getCompInit(Volcano)
export const componentInit = volcanoInit

export function getDefaultVolcanoSettings(overrides = {}): VolcanoSettings {
	const defaults: VolcanoSettings = {
		defaultSignColor: 'red',
		defaultNonSignColor: 'black',
		defaultHighlightColor: '#ffa200', // orange-yellow
		foldChangeCutoff: 0,
		/** Not enabling this feature for now */
		// geneORA: undefined,
		height: 400,
		minCount: 10,
		minTotalCount: 15,
		pValue: 0.05,
		pValueType: 'adjusted',
		rankBy: 'abs(foldChange)',
		showPValueTable: false,
		varGenesCutoff: 3000,
		width: 400
	}
	return Object.assign(defaults, overrides)
}

export function getPlotConfig(opts: any) {
	//if (!opts.termType) throw '.termType is required [Volcano getPlotConfig()]'
	const config = {
		highlightedData: opts.highlightedData,
		samplelst: opts.samplelst,
		settings: {
			volcano: getDefaultVolcanoSettings(opts.overrides || {})
		},
		termType: opts.termType
	}

	return copyMerge(config, opts)
}
