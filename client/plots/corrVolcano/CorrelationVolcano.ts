import { getCompInit, copyMerge, type RxComponent } from '#rx'
import { PlotBase } from '../PlotBase'
import { fillTermWrapper, fillTwLst } from '#termsetting'
import type { BasePlotConfig, MassAppApi, MassState } from '#mass/types/mass'
import { controlsInit } from '../controls'
import type { CorrVolcanoDom, CorrVolcanoOpts, CorrVolcanoSettings } from './CorrelationVolcanoTypes'
import { Menu } from '#dom'
import { Model } from './model/Model'
import { ViewModel } from './viewModel/ViewModel'
import { View } from './view/View'
import { CorrVolcanoInteractions } from './interactions/CorrVolcanoInteractions'

/** TODO:
 *  - Clean up noted tech debt
 *  - Add tests
 */

class CorrelationVolcano extends PlotBase implements RxComponent {
	static type = 'correlationVolcano'
	readonly type = 'correlationVolcano'
	components: { controls: any }
	/** Max radius user may enter in control or legend menu */
	readonly defaultInputMaxRadius = 35
	/** Min radius user may enter in control or legend menu */
	readonly defaultInputMinRadius = 1
	dom: CorrVolcanoDom
	variableTwLst: any
	interactions?: CorrVolcanoInteractions
	constructor(opts: any, api) {
		super(opts, api)
		this.opts = opts
		this.components = {
			controls: {}
		}
		const holder = opts.holder.classed('sjpp-corrVolcano-main', true)
		const controls = opts.controls ? holder : holder.append('div')
		const div = holder.append('div').style('padding', '5px').style('display', 'inline-block')
		const errorDiv = div.append('div').attr('id', 'sjpp-corrVolcano-error').style('opacity', 0.75)
		const svg = div.append('svg').style('display', 'inline-block').attr('id', 'sjpp-corrVolcano-svg')
		this.dom = {
			controls: controls.style('display', 'block'),
			div,
			error: errorDiv,
			svg,
			plot: svg.append('g'),
			title: svg.append('text'),
			yAxisLabel: svg.append('text'),
			xAxisLabel: svg.append('text'),
			legend: div.append('svg'),
			tip: new Menu({ padding: '' })
		}
		if (opts.header)
			this.dom.header = opts.header.text('CORRELATION VOLCANO').style('font-size', '0.7em').style('opacity', 0.6)
		this.variableTwLst = []
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			termdbConfig: appState.termdbConfig,
			termfilter: appState.termfilter,
			correlationVolcano: appState.termdbConfig.correlationVolcano,
			config: Object.assign({}, config, {
				settings: {
					correlationVolcano: config.settings.correlationVolcano
				}
			})
		}
	}

	async setControls() {
		const inputs = [
			{
				type: 'term',
				configKey: 'featureTw',
				chartType: 'correlationVolcano',
				usecase: { target: 'correlationVolcano', detail: 'numeric' },
				label: 'Feature',
				vocabApi: this.app.vocabApi,
				numericEditMenuVersion: ['continuous'],
				menuOptions: 'replace'
			},
			{
				label: 'Correlation method',
				title: 'Change the correlation method',
				type: 'radio',
				chartType: 'correlationVolcano',
				settingsKey: 'method',
				options: [
					{ label: 'Pearson', value: 'pearson' },
					{ label: 'Spearman', value: 'spearman' }
				]
			},
			{
				label: 'P value',
				title: 'Change the p value',
				type: 'radio',
				chartType: 'correlationVolcano',
				settingsKey: 'isAdjustedPValue',
				options: [
					{ label: 'Adjusted', value: true },
					{ label: 'Original', value: false }
				]
			},
			{
				label: 'Significant p value',
				title: 'Set the significant p value threshold',
				type: 'number',
				chartType: 'correlationVolcano',
				settingsKey: 'threshold',
				debounceInterval: 0.05
			},
			{
				label: 'Maximum radius size',
				title: 'Set maximum radius size in pixels',
				type: 'number',
				chartType: 'correlationVolcano',
				settingsKey: 'radiusMax',
				min: this.defaultInputMinRadius,
				max: this.defaultInputMaxRadius,
				debounceInterval: 500
			},
			{
				label: 'Minimum radius size',
				title: 'Set minimum radius size in pixels',
				type: 'number',
				chartType: 'correlationVolcano',
				settingsKey: 'radiusMin',
				min: this.defaultInputMinRadius,
				max: this.defaultInputMaxRadius,
				debounceInterval: 500
			},
			{
				label: 'Height',
				title: 'Set the height of the plot',
				type: 'number',
				chartType: 'correlationVolcano',
				settingsKey: 'height',
				debounceInterval: 500
			},
			{
				label: 'Width',
				title: 'Set the width of the plot',
				type: 'number',
				chartType: 'correlationVolcano',
				settingsKey: 'width',
				debounceInterval: 500
			},
			{
				label: 'Correlation color',
				type: 'color',
				chartType: 'correlationVolcano',
				settingsKey: 'corrColor',
				title: 'Color of correlated values'
			},
			{
				label: 'Anticorrelation color',
				type: 'color',
				chartType: 'correlationVolcano',
				settingsKey: 'antiCorrColor',
				title: 'Color of anticorrelated values'
			}
		]

		this.components.controls = await controlsInit({
			app: this.app,
			id: this.id,
			holder: this.dom.controls.attr('class', 'pp-termdb-plot-controls').style('display', 'inline-block'),
			inputs
		})

		this.components.controls.on('downloadClick.correlationVolcano', () => {
			this.interactions!.download()
		})
		this.components.controls.on('helpClick.correlationVolcano', () => {
			window.open('https://github.com/stjude/proteinpaint/wiki/Correlation-volcano', '_blank')
		})
	}

	async init(appState: MassState) {
		this.interactions = new CorrVolcanoInteractions(this.app, this.dom, this.id)
		const state = this.getState(appState)
		if (state.config['featureTw']) await this.setControls()
		//Hack because obj not returning in getState(). Will fix later.
		const dsCorrVolcano = state.termdbConfig.correlationVolcano

		//Fill the term wrapper for the drug list from the ds
		this.variableTwLst = dsCorrVolcano.variables.termIds.map((id: string) => {
			return { id }
		})
		this.interactions.variableTwLst = this.variableTwLst

		await fillTwLst(this.variableTwLst, this.app.vocabApi)
	}

	async main() {
		const config = structuredClone(this.state.config)
		if (config.childType != this.type && config.chartType != this.type) return

		if (!this.interactions) throw 'Interactions not initialized [correlationVolcano main()]'

		if (config.featureTw == null) {
			this.interactions.showTree()
			return
		}

		const settings = config.settings.correlationVolcano
		/** Request data from the server*/
		const model = new Model(config, this.state, this.app, settings, this.variableTwLst)
		const data = await model.getData()
		if (!data || data.error || !data.variableItems.length) {
			this.interactions.clearDom()
			this.dom.error.style('padding', '20px 20px 20px 60px').text(data.error || 'No correlation data to render.')
			return
		}

		/** Format returned data for rendering */
		const viewModel = new ViewModel(config, data, this.dom, settings, this.variableTwLst)

		/** Render correlation volcano plot */
		new View(
			this.dom,
			viewModel.viewData,
			this.interactions,
			settings,
			this.defaultInputMaxRadius,
			this.defaultInputMinRadius
		)
	}
}

export const corrVolcanoInit = getCompInit(CorrelationVolcano)
export const componentInit = corrVolcanoInit

export function getDefaultCorrVolcanoSettings(overrides = {}) {
	const defaults: CorrVolcanoSettings = {
		antiCorrColor: '#ff0000', //red
		corrColor: '#0000ff', //blue
		isAdjustedPValue: false,
		method: 'pearson',
		threshold: 0.05,
		height: 500,
		width: 500,
		radiusMax: 20,
		radiusMin: 5
	}
	return Object.assign(defaults, overrides)
}

export async function getPlotConfig(opts: CorrVolcanoOpts, app: MassAppApi) {
	//Opts.numeric returned from tree search when clicking on charts button
	//See logic in shared/utils/src/termdb.usecase.js for how tree is limited
	//May change this later
	if (opts.numeric && !opts.featureTw) opts.featureTw = { term: opts.numeric.term } as any
	/** If featureTw is passed, the plot will load per usual
	 * else a UI will appear allowing the uses to select the feature */
	if (opts.featureTw) {
		try {
			await fillTermWrapper(opts.featureTw, app.vocabApi)
		} catch (e) {
			console.error(new Error(`${e} [correlationVolcano getPlotConfig()]`))
			throw `correlationVolcano getPlotConfig() failed`
		}
	}

	const config = {
		chartType: 'correlationVolcano',
		featureTw: opts.featureTw ?? null,
		settings: {
			controls: {
				term2: null,
				term0: null
			},
			correlationVolcano: getDefaultCorrVolcanoSettings(opts.overrides || {})
		}
	}
	return copyMerge(config, opts)
}
