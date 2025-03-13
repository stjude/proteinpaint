import type { BasePlotConfig, MassState } from '#mass/types/mass'
import type { Elem } from '../../types/d3'
import { RxComponentInner } from '../../types/rx.d'
import { getCompInit, copyMerge } from '#rx'
import { Menu } from '#dom'
import { termType2label } from '#shared/terms.js'
import type { DiffAnalysisDom, DiffAnalysisOpts, DiffAnalysisPlotConfig } from './DiffAnalysisTypes'
import { DiffAnalysisView } from './view/DiffAnalysisView'
import { getDefaultVolcanoSettings } from '../volcano/Volcano.ts'
import { getDefaultGseaSettings } from '#plots/gsea.js'
import { DiffAnalysisInteractions } from './interactions/DiffAnalysisInteractions.ts'

/** TODO:
 * - type this file
 */
class DifferentialAnalysis extends RxComponentInner {
	readonly type = 'differentialAnalysis'
	components: {
		plots: { [key: string]: any }
	}
	dom: DiffAnalysisDom
	interactions?: DiffAnalysisInteractions
	plotTabs?: DiffAnalysisView
	plotsDiv: { [key: string]: Elem }
	plotControlsDiv: { [key: string]: Elem }
	termType: string

	constructor(opts: any) {
		super()
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
		//TODO: Fix this. Move to init()
		const volcanoControlsDiv = controls.append('div').style('display', 'none')
		const gseaControlsDiv = controls.append('div').style('display', 'none')
		this.plotControlsDiv = {
			volcano: volcanoControlsDiv,
			gsea: gseaControlsDiv
		}
		const volcanoDiv = plots.append('div').style('display', 'none')
		const gseaDiv = plots.append('div').style('display', 'none')
		this.plotsDiv = {
			volcano: volcanoDiv,
			gsea: gseaDiv
		}

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
			return action.id === this.id
		}
		if (action.type.startsWith('filter')) return true
		if (action.type.startsWith('cohort')) return true
		if (action.type == 'app_refresh') return true
	}

	async init(appState: MassState) {
		this.interactions = new DiffAnalysisInteractions(this.app)

		const state = this.getState(appState)
		const config = structuredClone(state.config) as DiffAnalysisPlotConfig

		const volcano = await import(`../volcano/Volcano.ts`)
		const gsea = await import(`#plots/gsea.js`)

		this.components.plots = {
			volcano: await volcano.componentInit({
				app: this.app,
				holder: this.plotsDiv.volcano,
				id: this.id,
				parent: this.api,
				controls: this.plotControlsDiv.volcano,
				diffAnalysisInteractions: this.interactions,
				termType: config.termType
			}),
			gsea: await gsea.componentInit({
				app: this.app,
				holder: this.plotsDiv.gsea,
				id: this.id,
				parent: this.api,
				controls: this.plotControlsDiv.gsea
			})
		}
		this.plotTabs = new DiffAnalysisView(this.app, config, this.dom, this.interactions)
	}

	main() {
		const config = structuredClone(this.state.config)
		if (config.chartType != this.type) return

		for (const childType in this.components.plots) {
			const chart = this.components.plots[childType]
			if (chart.type != config.childType) {
				this.plotsDiv[chart.type].style('display', 'none')
				this.plotControlsDiv[chart.type].style('display', 'none')
			}
		}
		this.plotsDiv[config.childType].style('display', '')
		this.plotControlsDiv[config.childType].style('display', '')

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
		settings: {
			controls: {
				isOpen: false
			},
			volcano: getDefaultVolcanoSettings(opts.overrides),
			gsea: getDefaultGseaSettings()
		}
	}
	return copyMerge(config, opts)
}
