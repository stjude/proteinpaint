import { RxComponentInner } from '../../types/rx.d'
import { getCompInit, copyMerge } from '#rx'
import type { BasePlotConfig, MassState } from '#mass/types/mass'

class SingleCell extends RxComponentInner {
	readonly type = 'singleCell'

	constructor(opts) {
		super()
		const holder = opts.holder.append('div').classed('sjpp-single-cell-main', true)
		this.dom = {
			holder,
			errorDiv: holder.append('div').attr('data-testid', 'sjpp-single-cell-error'),
			actionsDiv: holder.append('div').attr('data-testid', 'sjpp-single-cell-actions'),
			plotDiv: holder.append('div').attr('data-testid', 'sjpp-single-cell-plot')
		}
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

	async main() {
		const config = structuredClone(this.state.config)
		if (config.childType != this.type && config.chartType != this.type) return
	}
}

export const singleCellInit = getCompInit(SingleCell)
export const componentInit = singleCellInit

export function getDefaultSingleCellSettings(overrides = {}) {
	const defaults = {
		dotSize: 0.04,
		dotOpacity: 0.8,
		height: 600,
		showGrid: true,
		width: 600
	}
	return Object.assign(defaults, overrides)
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
