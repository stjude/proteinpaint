import type { BasePlotConfig, MassAppApi, MassState } from '#mass/types/mass'
import { RxComponentInner } from '../../types/rx.d'
import { getCompInit, copyMerge } from '#rx'
import { Menu } from '#dom'
// import { controlsInit } from '../controls'
import type { DEanalysisDom, DEanalysisOpts, DEanalysisSettings } from './DEanalysisTypes'
import { DEAnalysisInteractions } from './interactions/DEAnalysisInteractions'
import { Model } from './model/Model'
// import { View } from './view/View'
// import { ViewModel } from './viewModel/ViewModel'

export class DEanalysis extends RxComponentInner {
	readonly type = 'DEanalysis2' // This will change to 'DEanalysis' after this version is stable
	components: { controls: any }
	dom: DEanalysisDom
	interactions: DEAnalysisInteractions

	constructor(opts: any) {
		super()
		this.components = {
			controls: {}
		}
		const holder = opts.holder.classed('sjpp-de-analysis-main', true)
		const controls = opts.controls ? holder : holder.append('div')
		const div = holder.append('div').style('padding', '5px')
		const errorDiv = div.append('div').attr('id', 'sjpp-de-analysis-error').style('opacity', 0.75)
		const svg = div.append('svg').style('display', 'inline-block').attr('id', 'sjpp-de-analysis-svg')
		this.dom = {
			controls: controls.style('display', 'block'),
			div,
			error: errorDiv,
			svg,
			tip: new Menu({ padding: '' })
		}

		// if (opts.header) this.dom.header = opts.header.style('font-size', '0.7em').style('opacity', 0.6)
		if (opts.header) {
			this.dom.header = {
				title: opts.header.append('span'),
				fixed: opts.header
					.append('span')
					.style('font-size', '0.7em')
					.style('opacity', 0.6)
					.text(' DIFFERENTIAL ANALYSIS')
			}
		}

		this.interactions = new DEAnalysisInteractions()
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config: Object.assign({}, config, {
				settings: {
					DEanalysis: config.settings.DEanalysis
				}
			})
		}
	}

	async main() {
		const config = structuredClone(this.state.config)
		if (config.chartType != this.type) return

		const model = new Model(this.app, config, config.settings.DEanalysis)
		const data = await model.getData()
		if (!data || data.error) {
			this.interactions.clearDom()
			this.dom.error.text(data.error || 'No data returned from server')
		}

		if (this.dom.header) {
			const samplelst = config.samplelst.groups
			this.dom.header.title.text(`${samplelst[0].name} vs ${samplelst[1].name} `)
		}
		console.log(data)

		// const settings = config.settings.DEanalysis
	}
}

export const DEanalysisInit = getCompInit(DEanalysis)
export const componentInit = DEanalysisInit

function getDefaultDEanalysisSettings(overrides: Partial<DEanalysisSettings>): DEanalysisSettings {
	const defaults: DEanalysisSettings = {
		minCount: 10,
		minTotalCount: 15,
		varGenesCutoff: 3000
	}
	return Object.assign(defaults, overrides)
}

export function getPlotConfig(opts: DEanalysisOpts, app: MassAppApi) {
	const config = {
		chartType: 'DEanalysis2',
		settings: {
			controls: {
				term2: null,
				term0: null
			},
			DEanalysis: getDefaultDEanalysisSettings(opts.overrides || {})
		}
	}
	return copyMerge(config, opts)
}
