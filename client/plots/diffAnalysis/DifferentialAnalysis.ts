import type { BasePlotConfig, MassState } from '#mass/types/mass'
import type { Div } from '../../types/d3'
import { getCompInit, copyMerge, type RxComponent } from '#rx'
import { PlotBase } from '../PlotBase'
import { importPlot } from '../importPlot.js'
import { Menu } from '#dom'
import { termType2label } from '#shared/terms.js'
import type { DiffAnalysisDom, DiffAnalysisOpts, DiffAnalysisPlotConfig } from './DiffAnalysisTypes'
import { DiffAnalysisView } from './view/DiffAnalysisView'
import { getDefaultVolcanoSettings, validateVolcanoSettings } from '../volcano/Volcano.ts'
import { getDefaultGseaSettings } from '#plots/gsea.js'

/** TODO:
 * - type this file
 */
class DifferentialAnalysis extends PlotBase implements RxComponent {
	static type = 'differentialAnalysis'
	readonly type = 'differentialAnalysis'
	components: {
		plots: { [key: string]: any }
	}
	dom: DiffAnalysisDom
	plotTabs?: DiffAnalysisView
	plotsDiv: { [key: string]: Div }
	plotsControlsDiv: { [key: string]: Div }
	termType: string

	constructor(opts: any, api) {
		super(opts, api)
		this.components = {
			plots: {}
		}
		this.termType = opts.termType
		const holder = opts.holder.classed('sjpp-diff-analysis-main', true)
		const controls = opts.controls ? holder : holder.append('div')
		const div = holder
			.append('div')
			.style('padding', '5px')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
		const tabsDiv = div.append('div').attr('id', 'sjpp-diff-analysis-tabs').style('display', 'inline-block')
		const plots = div.append('div').attr('id', 'sjpp-diff-analysis-tabs-content')
		this.dom = {
			controls: controls.style('display', 'inline-block'),
			div,
			tabsDiv,
			plots: plots,
			tip: new Menu({ padding: '' })
		}
		this.plotsControlsDiv = {}
		this.plotsDiv = {}

		if (opts.header) {
			this.dom.header = {
				terms: opts.header.append('span'),
				title: opts.header.append('span').style('font-size', '0.8em').style('opacity', 0.7)
			}
		}
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}

		return {
			config
		}
	}

	reactsTo(action) {
		if (action.type.includes('cache_termq')) return true
		if (action.type.startsWith('plot_')) {
			return action.id === this.id || action.id == this.parentId
		}
		if (action.type.startsWith('filter')) return true
		if (action.type.startsWith('cohort')) return true
		if (action.type == 'app_refresh') return true
	}

	async init(appState: MassState) {
		const state = this.getState(appState)
		const config = structuredClone(state.config) as DiffAnalysisPlotConfig

		this.plotTabs = new DiffAnalysisView(this.app, config, this.dom)
	}

	async setComponent(config: DiffAnalysisPlotConfig) {
		this.plotsControlsDiv[config.childType] = this.dom.controls.append('div')
		this.plotsDiv[config.childType] = this.dom.plots.append('div')
		const opts = {
			app: this.app,
			holder: this.plotsDiv[config.childType],
			id: this.id,
			parent: this.api,
			controls: this.plotsControlsDiv[config.childType],
			termType: config.termType
		}
		const _ = await importPlot(config.childType, `unsupported childType='${config.childType}'`)
		this.components.plots[config.childType] = await _.componentInit(opts)
	}

	async main() {
		const config = structuredClone(this.state.config)
		if (config.chartType != this.type) return

		if (!this.components.plots[config.childType]) await this.setComponent(config)

		for (const childType in this.components.plots) {
			const chart = this.components.plots[childType]
			if (chart.type != config.childType) {
				this.plotsDiv[chart.type].style('display', 'none')
				this.plotsControlsDiv[chart.type].style('display', 'none')
			}
		}
		this.plotsDiv[config.childType].style('display', '')
		this.plotsControlsDiv[config.childType].style('display', '')

		if (this.dom.header) {
			this.dom.header.terms.text(config.tw.term.name)
			const typeStr = termType2label(config.termType).toUpperCase()
			this.dom.header.title.text(` DIFFERENTIAL ${typeStr} ANALYSIS`)
		}

		if (this.plotTabs) this.plotTabs.update(config)
	}
}

export const DiffAnalysisInit = getCompInit(DifferentialAnalysis)
export const componentInit = DiffAnalysisInit

//Use this as a sanity check.
const enabledTermTypes = ['geneExpression']

export function getPlotConfig(opts: DiffAnalysisOpts) {
	if (!opts.termType) throw '.termType is required [DifferentialAnalysis getPlotConfig()]'
	if (!enabledTermTypes.includes(opts.termType))
		throw `termType '${opts.termType}' not supported by DifferentialAnalysis`

	const config = {
		chartType: 'differentialAnalysis',
		childType: 'volcano',
		termType: opts.termType,
		highlightedData: opts.highlightedData || [],
		settings: {}
		//PlotFilter: true //TODO: Support filtering and reactivity in child plots
	} as any

	if (opts.termType == 'geneExpression') {
		config.settings.volcano = getDefaultVolcanoSettings(opts.overrides || {}, opts)
		config.settings.gsea = getDefaultGseaSettings(opts.overrides || {})

		validateVolcanoSettings(config, opts)
	}

	return copyMerge(config, opts)
}
