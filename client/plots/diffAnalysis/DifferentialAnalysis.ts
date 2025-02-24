import type { BasePlotConfig, MassAppApi, MassState } from '#mass/types/mass'
import { RxComponentInner } from '../../types/rx.d'
import { getCompInit, copyMerge } from '#rx'
import { Menu } from '#dom'
import type { DiffAnalysisDom, DiffAnalysisOpts } from './DiffAnalysisTypes'
import { View } from './view/View'
import { getDefaultVolcanoSettings } from './Volcano'

/** TODO:
 * - type this file
 * - remove method from server request -> always 'edgeR'
 */
class DifferentialAnalysis extends RxComponentInner {
	readonly type = 'differentialAnalysis'
	components: { controls: any; plots: any }
	dom: DiffAnalysisDom
	plots = {}
	tabs = {}

	constructor(opts: any) {
		super()
		this.components = {
			controls: {},
			plots: {}
		}
		const holder = opts.holder.classed('sjpp-diff-analysis-main', true)
		const controls = opts.controls ? holder : holder.append('div')
		const div = holder.append('div').style('padding', '5px').style('display', 'inline-block')
		const tabs = div.append('div').attr('id', 'sjpp-diff-analysis-tabs').style('display', 'inline-block')
		const tabsContent = div.append('div').attr('id', 'sjpp-diff-analysis-tabs-content')
		this.dom = {
			controls: controls.style('display', 'block'),
			div,
			tabs,
			tabsContent,
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

	async setPlotComponents(config) {
		// !!! quick fix for rollup to bundle,
		// will eventually need to move to a subnested folder structure
		let _
		if (config.childType == 'volcano') _ = await import(`./Volcano.ts`)
		else if (config.childType == 'gsea') _ = await import(`#plots/gsea.js`)
		else if (config.childType == 'geneORA') _ = await import(`#plots/geneORA.js`)
		else throw `unsupported childType='${config.childType}'`

		this.plots[config.childType] = this.dom.tabsContent.append('div')

		// assumes only 1 chart per chartType would be rendered in the summary sandbox
		this.components.plots[config.childType] = await _.componentInit({
			app: this.app,
			holder: this.plots[config.childType],
			id: this.id,
			parent: this.api
		})

		this.tabs = new View(this.app, config, this.dom)
	}

	async main() {
		const config = structuredClone(this.state.config)
		if (config.chartType != this.type) return

		if (!this.components.plots[config.childType]) {
			await this.setPlotComponents(config)
		}

		for (const childType in this.components.plots) {
			const chart = this.components.plots[childType]
			if (chart.type != config.childType) {
				this.plots[chart.type].style('display', 'none')
			}
		}

		this.plots[config.childType].style('display', '')

		if (this.dom.header) {
			const samplelst = config.samplelst.groups
			this.dom.header.title.text(`${samplelst[0].name} vs ${samplelst[1].name} `)
		}
	}
}

export const DiffAnalysisInit = getCompInit(DifferentialAnalysis)
export const componentInit = DiffAnalysisInit

export function getPlotConfig(opts: DiffAnalysisOpts, app: MassAppApi) {
	const config = {
		chartType: 'differentialAnalysis',
		childType: 'volcano',
		highlightedData: opts.highlightedData || [],
		settings: {
			controls: {
				isOpen: false
			},
			differentialAnalysis: { visiblePlots: ['volcano'] },
			volcano: getDefaultVolcanoSettings(opts.overrides)
		}
	}
	return copyMerge(config, opts)
}
