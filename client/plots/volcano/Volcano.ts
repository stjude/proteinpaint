import type { MassState, BasePlotConfig, MassAppApi } from '#mass/types/mass'
import { getCompInit, copyMerge, type RxComponent } from '#rx'
import { PlotBase } from '../PlotBase'
import { fillTermWrapper } from '#termsetting'
import { Menu, sayerror } from '#dom'
import { controlsInit } from '../controls'
import { roundValue } from '#shared/roundValue.js'
import type { VolcanoOpts, VolcanoSettings, VolcanoDom } from './VolcanoTypes'
import { VolcanoModel } from './model/VolcanoModel'
import { VolcanoViewModel } from './viewModel/VolcanoViewModel'
import { VolcanoInteractions } from './interactions/VolcanoInteractions'
import { VolcanoPlotView } from './view/VolcanoPlotView'
import { VolcanoControlInputs } from './VolcanoControlInputs'

// The max sample cutoff for volcano rendering
const maxSampleCutoff = 4000

class Volcano extends PlotBase implements RxComponent {
	static type = 'volcano'
	readonly type = 'volcano'
	components: { controls: any }
	dom: VolcanoDom
	interactions?: VolcanoInteractions
	termType: string
	constructor(opts: VolcanoOpts, api) {
		super(opts, api)
		this.components = {
			controls: {}
		}
		this.termType = opts.termType
		const holder = opts.holder.classed('sjpp-diff-analysis-main', true)
		//Either allow a node to be passed or create a new div
		const controls = typeof opts.controls == 'object' ? opts.controls : holder || (holder as any).append('div')
		const error = opts.holder.append('div').attr('id', 'sjpp-diff-analysis-error').style('opacity', 0.75) as any
		this.dom = {
			holder,
			controls,
			error,
			wait: holder
				.append('div')
				.attr('id', 'sjpp-diff-analysis-wait')
				.style('opacity', 0.75)
				.style('padding', '20px')
				.text('Loading...') as any,
			tip: new Menu({ padding: '' }),
			actionsTip: new Menu({ padding: '' })
		}
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
		const plotConfig = this.app.getState().plots.find((p: any) => p.id === this.id)
		const controls = new VolcanoControlInputs(plotConfig, this.termType)

		this.components.controls = await controlsInit({
			app: this.app,
			id: this.id,
			holder: this.dom.controls.attr('class', 'pp-termdb-plot-controls').style('display', 'inline-block'),
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
		await this.setControls()
	}

	async main() {
		const config = structuredClone(this.state.config)
		if (config.chartType != this.type && config.childType != this.type) return

		const settings = config.settings.volcano
		try {
			if (!this.interactions) throw 'Interactions not initialized [main() Volcano.ts]'

			//Only show Loading for data requests that take longer than 500ms
			const showWait = setTimeout(() => {
				this.dom.wait.style('display', 'block')
			}, 500)

			/** Fetch data */
			const model = new VolcanoModel(this.app, config, settings)
			const response = await model.getData()
			if (!response || response.error || !response.data.length) {
				sayerror(this.dom.error, response.error || 'No data returned from server')
				clearTimeout(showWait)
				this.dom.wait.style('display', 'none')
				return
			}

			this.interactions.clearDom()

			/** Format response into an object for rendering */
			const viewModel = new VolcanoViewModel(config, response, settings)
			//Pass table data for downloading
			this.interactions.pValueTableData = viewModel.viewData.pValueTableData
			this.interactions.data = response.data

			clearTimeout(showWait)
			this.dom.wait.style('display', 'none')
			/** Render formatted data */
			new VolcanoPlotView(this.dom, settings, viewModel.viewData, this.interactions, config.termType)
		} catch (e: any) {
			if (e instanceof Error) console.error(e.message || e)
			else if (e.stack) console.log(e.stack)
			throw e
		}
	}
}

export const volcanoInit = getCompInit(Volcano)
export const componentInit = volcanoInit

export function getDefaultVolcanoSettings(overrides = {}, opts: any): VolcanoSettings {
	const features = JSON.parse(sessionStorage.getItem('optionalFeatures') as string)
	const method = features?.runDE_methods?.includes('Wilcoxon') ? 'wilcoxon' : 'edgeR'
	const defaults: VolcanoSettings = {
		defaultSignColor: 'red',
		defaultNonSignColor: 'black',
		defaultHighlightColor: '#ffa200', // orange-yellow
		foldChangeCutoff: 0,
		/** Not enabling this feature for now */
		// geneORA: undefined,
		height: 400,
		method,
		minCount: 10,
		minTotalCount: 15,
		pValue: roundValue(-Math.log10(0.05), 2),
		pValueType: 'adjusted',
		rankBy: 'abs(foldChange)',
		//Only declare this value in one place
		sampleNumCutoff: opts.termType == 'geneExpression' ? 3000 : maxSampleCutoff,
		width: 400
	}

	return Object.assign(defaults, overrides)
}

export function getSampleNum(config: any) {
	return config.samplelst.groups.reduce((sum: number, g: any) => sum + g.values.length, 0)
}

export function validateVolcanoSettings(config: any, opts: any) {
	if (!config.settings.volcano) return
	const settings = config.settings.volcano
	const sampleNum = getSampleNum(opts)
	if (sampleNum > maxSampleCutoff) {
		throw `Sample size ${sampleNum} exceeds max sample size of ${maxSampleCutoff}. Please reduce sample size.`
	}

	if (config.termType == 'geneExpression') {
		const largeNum = sampleNum > settings.sampleNumCutoff

		if (!opts.overrides && largeNum) {
			settings.method = 'wilcoxon'
		} else if (largeNum && settings.method != 'wilcoxon') {
			throw `${settings.method} is not supported for ${sampleNum} samples when termtype = ${config.termType}. Please use Wilcoxon.`
		}
	}
}

export async function getPlotConfig(opts: VolcanoOpts, app: MassAppApi) {
	if (!opts.termType) throw '.termType is required [Volcano getPlotConfig()]'
	if (opts.confounderTws) {
		try {
			for (const tw of opts.confounderTws) {
				await fillTermWrapper(tw, app.vocabApi)
			}
		} catch (e: any) {
			console.error(new Error(`${e} [volcano getPlotConfig()]`))
			throw `volcano getPlotConfig() failed`
		}
	}

	const config = {
		confounderTws: opts.confounderTws || [],
		highlightedData: opts.highlightedData || [],
		samplelst: opts.samplelst,
		settings: {
			volcano: getDefaultVolcanoSettings(opts.overrides || {}, opts)
		},
		termType: opts.termType
	}

	//Validate user submitted unavailable/inappropriate settings
	validateVolcanoSettings(config, opts)

	return copyMerge(config, opts)
}
