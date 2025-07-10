import { RxComponentInner } from '../../types/rx.d'
import { getCompInit, copyMerge } from '#rx'
import type { MassState } from '#mass/types/mass'
import { getDefaultAIHistoToolSettings } from './defaults'
import { Model } from './model/Model'
import { View } from './view/View'
import { AIHistoInteractions } from './interactions/AIHistoInteractions'

class AIHistoTool extends RxComponentInner {
	public type = 'AIHistoTool'
	model: Model
	projects?: any[]
	view?: View
	interactions?: AIHistoInteractions

	constructor(opts: any) {
		super()
		this.opts = opts
		this.dom = {
			holder: opts.holder
		}
		this.model = new Model()
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

	async init(appState: MassState) {
		this.interactions = new AIHistoInteractions(this.app, this.id, this.model)

		try {
			this.projects = await this.model.getProjects(appState.vocab.genome, appState.vocab.dslabel)
		} catch (e: any) {
			console.error('Error initializing AIHistoTool:', e)
			throw e
		}
		this.view = new View(this.dom, this.projects, this.interactions)
		this.view.render()
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
