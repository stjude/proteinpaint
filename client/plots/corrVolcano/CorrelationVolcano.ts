import { getCompInit, copyMerge } from '#rx'
import { RxComponentInner } from '../../types/rx.d'
import { fillTermWrapper } from '#termsetting'
import type { BasePlotConfig, MassAppApi, MassState } from '#mass/types/mass'
import type { Elem, SvgSvg } from '../../types/d3'
import { Model } from './model/Model'
import { ViewModel } from './viewModel/ViewModel'
import { View } from './view/View'

/**
 * TODOs:
 * - WILL DO ALL TYPING AFTER INITIAL PROTOTYPE
 */

export type CorrVolcanoSettings = {
	height: number
	method: 'pearson' | 'spearman'
	width: number
}

export type CorrVolcanoPlotConfig = BasePlotConfig & {
	featureTw: any
}

class CorrelationVolcano extends RxComponentInner {
	readonly type = 'correlationVolcano'
	components: { controls: any }
	dom: any
	dsCorrVolcano: any
	constructor(opts: any) {
		super()
		this.opts = opts
		this.components = {
			controls: {}
		}
		const holder = opts.holder.classed('sjpp-corrVolcano-main', true)
		const controls = opts.controls ? holder : holder.append('div')
		const div = holder.append('div').style('padding', '5px')
		const errorDiv = div.append('div').attr('id', 'sjpp-corrVolcano-error').style('opacity', 0.75)
		const svg = div.append('svg').style('display', 'inline-block').attr('id', 'sjpp-corrVolcano-svg')
		this.dom = {
			controls: controls as Elem,
			div,
			error: errorDiv,
			svg
		}
		this.dsCorrVolcano = {}
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

	init(appState) {
		//TODO: Will figure out controls later

		//Hack because obj not returning in getState(). Will fix later.
		this.dsCorrVolcano = appState.termdbConfig.correlationVolcano
	}

	async main() {
		const config = structuredClone(this.state.config)
		if (config.childType != this.type && config.chartType != this.type) return

		const settings = config.settings.correlationVolcano
		const variableTwLst = this.dsCorrVolcano.variables.termIds.map((id: string) => {
			return { id }
		})
		for (const t of variableTwLst) await fillTermWrapper(t, this.app.vocabApi)
		/** Request data from the server*/
		const model = new Model(config, this.state, this.app, settings, variableTwLst)
		const data = await model.getData()

		/** Format returned data for rendering */
		const viewModel = new ViewModel(config, data, settings, variableTwLst)

		/** Render correlation volcano plot */
		new View(this.dom, viewModel.viewData)
	}
}

export const corrVolcanoInit = getCompInit(CorrelationVolcano)
export const componentInit = corrVolcanoInit

export function getDefaultCorrVolcanoSettings(app, overrides = {}) {
	const defaults: CorrVolcanoSettings = {
		height: 400,
		method: 'pearson',
		width: 400
	}
	return Object.assign(defaults, overrides)
}

export async function getPlotConfig(opts: any, app: MassAppApi) {
	if (!opts.featureTw) throw 'opts.featureTw{} missing [correlationVolcano getPlotConfig()]'
	try {
		await fillTermWrapper(opts.featureTw, app.vocabApi)
	} catch (e) {
		console.error(new Error(`${e} [correlationVolcano getPlotConfig()]`))
		throw `correlationVolcano getPlotConfig() failed`
	}

	const config = {
		featureTw: opts.featureTw,
		settings: {
			controls: {
				term2: null,
				term0: null
			},
			correlationVolcano: getDefaultCorrVolcanoSettings(app, opts.overrides || {})
		}
	}
	return copyMerge(config, opts)
}
