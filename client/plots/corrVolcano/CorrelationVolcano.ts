import { getCompInit, copyMerge } from '#rx'
import { RxComponentInner } from '../../types/rx.d'
import { fillTermWrapper } from '#termsetting'
import type { MassAppApi } from '#mass/types/mass'

class CorrelationVolcano extends RxComponentInner {
	readonly type = 'correlationVolcano'
	constructor(opts) {
		super()
	}
}

export const corrVolcanoInit = getCompInit(CorrelationVolcano)
export const componentInit = corrVolcanoInit

export function getDefaultCorrVolcanoSettings(app, overrides = {}) {
	const defaults = {
		//TODO
	}
	return Object.assign(defaults, overrides)
}

export async function getPlotConfig(opts, app: MassAppApi) {
	if (!opts.term) throw 'opts.term{} missing [correlationVolcano getPlotConfig()]'
	try {
		await fillTermWrapper(opts.term, app.vocabApi)
	} catch (e) {
		console.error(new Error(`${e} [correlationVolcano getPlotConfig()]`))
		throw `correlationVolcano getPlotConfig() failed`
	}

	const config = {
		id: opts.term.term.id,
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
