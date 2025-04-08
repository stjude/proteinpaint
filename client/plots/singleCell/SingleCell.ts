import { RxComponentInner } from '../../types/rx.d'
import { getCompInit, copyMerge } from '#rx'
import { BasePlotConfig, MassAppActions, MassState } from '#mass/types/mass'

class SingleCell extends RxComponentInner {
	readonly type = 'singleCell'
	constructor(opts) {
		super()
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config,
			termfilter: appState.termfilter,
			termdbConfig: appState.termdbConfig
		}
	}
	reactsTo(action: MassAppActions) {
		if (action.type.includes('cache_termq')) return true
		if (action.type.startsWith('plot_')) {
			return action.id === this.id
		}
		if (action.type.startsWith('filter')) return true
		return false
	}

	async main() {
		const config = structuredClone(this.state.config)
		if (config.childType != this.type && config.chartType != this.type) return
	}
}

export const singleCellInit = getCompInit(SingleCell)
export const componentInit = singleCellInit

export function getDefaultSingleCellSettings(overrides = {}) {
	return {
		// Add default settings for SingleCell here
	}
}

export function getPlotConfig(opts) {
	const config = {
		chartType: 'singleCell',
		settings: {
			singleCell: getDefaultSingleCellSettings(opts.overrides)
		}
	}

	return copyMerge(config, opts)
}
