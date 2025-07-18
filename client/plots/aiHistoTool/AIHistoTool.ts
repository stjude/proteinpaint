import { RxComponentInner } from '../../types/rx.d'
import { getCompInit, copyMerge } from '#rx'
import type { MassState } from '#mass/types/mass'
import { getDefaultAIHistoToolSettings } from './defaults'
import { Model } from './model/Model'
import { ProjectAdminRender } from './view/ProjectAdminRender'
import { AIHistoInteractions } from './interactions/AIHistoInteractions'
import { CreateProjectRender } from './view/CreateProjectRender'
import { sayerror } from '#dom'

class AIHistoTool extends RxComponentInner {
	public type = 'AIHistoTool'
	model: Model
	projects?: any[]
	prjtAdminUI?: ProjectAdminRender
	interactions?: AIHistoInteractions

	constructor(opts: any) {
		super()
		this.opts = opts
		this.dom = {
			holder: opts.holder,
			errorDiv: opts.holder.append('div').style('padding', '3px').attr('class', 'sjpp-ai-histo-tool-error')
		}
		this.model = new Model()
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: any) => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config,
			vocab: appState.vocab
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
		this.prjtAdminUI = new ProjectAdminRender(this.dom, this.projects, this.interactions)
		this.prjtAdminUI.renderProjectAdmin()
	}

	async main() {
		const state = structuredClone(this.state)
		const config = state.config
		if (config.chartType != this.type) return
		if (!config.settings.project) return

		this.dom.holder.selectAll('.sjpp-deletable-ai-histo-div').remove()

		if (config.settings.project.type === 'new') {
			const terms = await this.model.getTerms(state.vocab, this.app)
			if (!terms || terms.length === 0) {
				sayerror(this.dom.errorDiv, 'No metadata found.')
				return
			}
			new CreateProjectRender(terms, this.dom)
		}
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
