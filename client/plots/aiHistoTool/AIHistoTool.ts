import { RxComponentInner } from '../../types/rx.d'
import { getCompInit, copyMerge } from '#rx'
import type { MassState } from '#mass/types/mass'
import { getDefaultAIHistoToolSettings } from './defaults'

class AIHistoTool extends RxComponentInner {
	public type = 'AIHistoTool'

	constructor() {
		super()
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: any) => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config
		}
	}

	main() {
		const config = structuredClone(this.state.config)
		if (config.chartType != this.type) return
	}
}

export const aiHistoToolInit = getCompInit(AIHistoTool)
export const componentInit = aiHistoToolInit

export async function getPlotConfig(opts: any) {
	const config = {
		chartType: 'AIHistoTool',
		subfolder: 'aiHistoTool',
		extension: 'ts',
		settings: getDefaultAIHistoToolSettings(opts.overrides)
	}

	return copyMerge(config, opts)
}
