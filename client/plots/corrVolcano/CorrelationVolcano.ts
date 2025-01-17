import { getCompInit, copyMerge } from '#rx'
import { RxComponentInner } from '../../types/rx.d'
import { fillTermWrapper } from '#termsetting'
import type { BasePlotConfig, MassAppApi, MassState } from '#mass/types/mass'
import type { Div, Elem, SvgG, SvgSvg, SvgText } from '../../types/d3'
import { Model } from './model/Model'

/**
 * TODOs:
 * - WILL DO ALL TYPING AFTER INITIAL PROTOTYPE
 */

export type CorrVolcanoSettings = {
	method: 'pearson' | 'spearman'
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
		const holder = opts.holder.classed('sjpp-boxplot-main', true)
		const controls = opts.controls ? holder : holder.append('div')
		const div = holder.append('div').style('padding', '5px')
		const errorDiv = div.append('div').attr('id', 'sjpp-boxplot-error').style('opacity', 0.75)
		this.dom = {
			controls: controls as Elem,
			div,
			error: errorDiv
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
		/** Request data from the server*/
		const model = new Model(config, this.state, this.app, settings, this.dsCorrVolcano)
		const data = await model.getData()
	}
}

export const corrVolcanoInit = getCompInit(CorrelationVolcano)
export const componentInit = corrVolcanoInit

export function getDefaultCorrVolcanoSettings(app, overrides = {}) {
	const defaults: CorrVolcanoSettings = {
		method: 'pearson'
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
