import { getCompInit, copyMerge } from '#rx'
import { RxComponentInner } from '../../types/rx.d'
import { fillTermWrapper } from '#termsetting'
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

class CorrelationVolcano extends RxComponentInner {
	readonly type = 'correlationVolcano'
	private components: { controls: any }
	dom: CorrVolcanoDom
	dsCorrVolcano: any
	variableTwLst: any
	interactions: CorrVolcanoInteractions
	constructor(opts: any) {
		super()
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
		this.dsCorrVolcano = {}
		this.variableTwLst = []
		this.interactions = new CorrVolcanoInteractions(this.app, this.dom, this.id)
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
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
			this.interactions.download()
		})
	}

	async init(appState: MassState) {
		await this.setControls()
		//Hack because obj not returning in getState(). Will fix later.
		this.dsCorrVolcano = appState.termdbConfig.correlationVolcano

		//Fill the term wrapper for the drug list from the ds
		this.variableTwLst = this.dsCorrVolcano.variables.termIds.map((id: string) => {
			return { id }
		})
		for (const t of this.variableTwLst) await fillTermWrapper(t, this.app.vocabApi)
		this.interactions.setVars(this.app, this.id, this.variableTwLst)
	}

	async main() {
		const config = structuredClone(this.state.config)
		if (config.childType != this.type && config.chartType != this.type) return

		const settings = config.settings.correlationVolcano

		/** Request data from the server*/
		const model = new Model(config, this.state, this.app, settings, this.variableTwLst)
		const data = await model.getData()
		if (!data || data['error']) {
			this.interactions.clearDom()
			this.dom.error.text(data['error'] || 'No data returned from server')
		}

		/** Format returned data for rendering */
		const viewModel = new ViewModel(config, data, settings, this.variableTwLst)

		/** Render correlation volcano plot */
		new View(this.dom, viewModel.viewData, this.interactions, settings)
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
		width: 500
	}
	return Object.assign(defaults, overrides)
}

export async function getPlotConfig(opts: CorrVolcanoOpts, app: MassAppApi) {
	//Opts.numeric returned from tree search when clicking on charts button
	//See logic in shared/utils/src/termdb.usecase.js for how tree is limited
	//May change this later
	if (opts.numeric && !opts.featureTw) opts.featureTw = { term: opts.numeric.term } as any
	if (!opts.featureTw) throw 'opts.featureTw{} missing [correlationVolcano getPlotConfig()]'
	try {
		await fillTermWrapper(opts.featureTw, app.vocabApi)
	} catch (e) {
		console.error(new Error(`${e} [correlationVolcano getPlotConfig()]`))
		throw `correlationVolcano getPlotConfig() failed`
	}

	const config = {
		chartType: 'correlationVolcano',
		featureTw: opts.featureTw,
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
