import type { BasePlotConfig, MassAppApi, MassState } from '#mass/types/mass'
import { RxComponentInner } from '../../types/rx.d'
import { getCompInit, copyMerge } from '#rx'
import { Menu } from '#dom'
// import { controlsInit } from '../controls'
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
		const div = holder.append('div').style('padding', '5px')
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

	async main() {
		const config = structuredClone(this.state.config)
		if (config.chartType != this.type) return

		const model = new Model(this.app, config, config.settings.differentialAnalysis)
		const data = await model.getData()
		if (!data || data.error) {
			this.interactions.clearDom()
			this.dom.error.text(data.error || 'No data returned from server')
		}

		if (this.dom.header) {
			const samplelst = config.samplelst.groups
			this.dom.header.title.text(`${samplelst[0].name} vs ${samplelst[1].name} `)
		}

		const settings = config.settings.differentialAnalysis

		const view = new ViewModel(config, this.dom, data, settings)

		new View(this.dom, this.interactions, view.viewData)
	}
}

export const DiffAnalysisInit = getCompInit(DifferentialAnalysis)
export const componentInit = DiffAnalysisInit

function getDefaultDiffAnalysisSettings(overrides: Partial<DiffAnalysisSettings>): DiffAnalysisSettings {
	const defaults: DiffAnalysisSettings = {
		foldChangeCutoff: 0,
		height: 400,
		minCount: 10,
		minTotalCount: 15,
		pValue: 0.05,
		pValueType: 'original',
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
