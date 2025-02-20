import type { BasePlotConfig, MassAppApi, MassState } from '#mass/types/mass'
import { RxComponentInner } from '../../types/rx.d'
import { getCompInit, copyMerge } from '#rx'
import { Menu } from '#dom'
import { controlsInit } from '../controls'
import type { DiffAnalysisDom, DiffAnalysisOpts, DiffAnalysisSettings } from './DiffAnalysisTypes'
import { DiffAnalysisInteractions } from './interactions/DiffAnalysisInteractions'
import { Model } from './model/Model'
import { ViewModel } from './viewModel/ViewModel'
import { View } from './view/View'

export class DifferentialAnalysis extends RxComponentInner {
	readonly type = 'differentialAnalysis'
	components: { controls: any }
	dom: DiffAnalysisDom
	interactions: DiffAnalysisInteractions

	constructor(opts: any) {
		super()
		this.components = {
			controls: {}
		}
		const holder = opts.holder.classed('sjpp-diff-analysis-main', true)
		const controls = opts.controls ? holder : holder.append('div')
		const div = holder.append('div').style('padding', '5px').style('display', 'inline-block')
		const errorDiv = div.append('div').attr('id', 'sjpp-diff-analysis-error').style('opacity', 0.75)
		const svg = div.append('svg').style('display', 'inline-block').attr('id', 'sjpp-diff-analysis-svg')
		this.dom = {
			controls: controls.style('display', 'block'),
			div,
			error: errorDiv,
			svg,
			xAxis: svg.append('g').attr('id', 'sjpp-diff-analysis-xAxis'),
			yAxis: svg.append('g').attr('id', 'sjpp-diff-analysis-yAxis'),
			xAxisLabel: svg.append('text').attr('id', 'sjpp-diff-analysis-xAxisLabel').attr('text-anchor', 'middle'),
			yAxisLabel: svg.append('text').attr('id', 'sjpp-diff-analysis-yAxisLabel').attr('text-anchor', 'middle'),
			plot: svg.append('g').attr('id', 'sjpp-diff-analysis-plot'),
			tip: new Menu({ padding: '' })
		}

		if (opts.header) {
			this.dom.header = {
				title: opts.header.append('span'),
				fixed: opts.header
					.append('span')
					.style('font-size', '0.8em')
					.style('opacity', 0.7)
					.text(' DIFFERENTIAL ANALYSIS')
			}
		}

		this.interactions = new DiffAnalysisInteractions(this.dom)
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config: Object.assign({}, config, {
				settings: {
					differentialAnalysis: config.settings.differentialAnalysis
				}
			})
		}
	}

	async setControls() {
		const inputs = [
			{
				label: 'Minimum Read Count',
				type: 'number',
				chartType: 'differentialAnalysis',
				settingsKey: 'minCount',
				title: 'The smallest number of reads required for a gene to be considered in the analysis',
				min: 0,
				max: 10000
			},
			{
				label: 'Minimum Total Read Count',
				type: 'number',
				chartType: 'differentialAnalysis',
				settingsKey: 'minTotalCount',
				title: 'The smallest total number of reads required for a gene to be considered in the analysis',
				min: 0,
				max: 10000
			},
			{
				label: 'P value Significance (Linear Scale)',
				type: 'number',
				chartType: 'differentialAnalysis',
				settingsKey: 'pValue',
				title: 'The p-value threshold to determine statistical significance',
				min: 0,
				max: 1
			},
			{
				label: 'Fold Change (Log Scale)',
				type: 'number',
				chartType: 'differentialAnalysis',
				settingsKey: 'foldChangeCutoff',
				title: 'The fold change threshold to determine biological significance',
				min: -10,
				max: 10
			},
			{
				label: 'P value',
				type: 'radio',
				chartType: 'differentialAnalysis',
				settingsKey: 'pValueType',
				title: 'Toggle between original and adjusted pvalues for volcano plot',
				options: [
					{ label: 'adjusted', value: 'adjusted' },
					{ label: 'original', value: 'original' }
				]
			},
			{
				label: 'Variable Genes Cutoff',
				type: 'number',
				chartType: 'differentialAnalysis',
				settingsKey: 'varGenesCutoff',
				title: 'Top number of genes with the highest variability to include in analysis',
				min: 1000,
				max: 4000
			},
			{
				label: 'Show P value Table',
				type: 'checkbox',
				chartType: 'differentialAnalysis',
				settingsKey: 'showPValueTable',
				title: 'Show table with both original and adjusted p values for all significant genes',
				boxLabel: ''
			}
		]

		this.components.controls = await controlsInit({
			app: this.app,
			id: this.id,
			holder: this.dom.controls.attr('class', 'pp-termdb-plot-controls').style('display', 'inline-block'),
			inputs
		})
	}

	async init() {
		await this.setControls()
	}

	async main() {
		const config = structuredClone(this.state.config)
		if (config.chartType != this.type) return

		try {
			const settings = config.settings.differentialAnalysis
			/** Fetch data */
			const model = new Model(this.app, config, settings)
			const response = await model.getData()
			if (!response || response.error) {
				this.interactions.clearDom()
				this.dom.error.text(response.error || 'No data returned from server')
			}
			if (this.dom.header) {
				const samplelst = config.samplelst.groups
				this.dom.header.title.text(`${samplelst[0].name} vs ${samplelst[1].name} `)
			}
			/** Format response into an object for rendering */
			const view = new ViewModel(config, response, settings)
			/** Render formatted data */
			new View(this.dom, this.interactions, view.viewData)
		} catch (e: any) {
			if (e instanceof Error) console.error(e.message || e)
			else if (e.stack) console.log(e.stack)
			throw e
		}
	}
}

export const DiffAnalysisInit = getCompInit(DifferentialAnalysis)
export const componentInit = DiffAnalysisInit

function getDefaultDiffAnalysisSettings(overrides = {}): DiffAnalysisSettings {
	const defaults: DiffAnalysisSettings = {
		foldChangeCutoff: 0,
		height: 400,
		minCount: 10,
		minTotalCount: 15,
		pValue: 0.05,
		pValueType: 'adjusted',
		showPValueTable: false,
		varGenesCutoff: 3000,
		width: 400
	}
	return Object.assign(defaults, overrides)
}

export function getPlotConfig(opts: DiffAnalysisOpts, app: MassAppApi) {
	const config = {
		chartType: 'differentialAnalysis',
		settings: {
			controls: {
				term2: null,
				term0: null
			},
			differentialAnalysis: getDefaultDiffAnalysisSettings(opts.overrides || {})
		}
	}
	return copyMerge(config, opts)
}
