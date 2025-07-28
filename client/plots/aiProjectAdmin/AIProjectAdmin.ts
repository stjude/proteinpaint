import { RxComponentInner } from '../../types/rx.d'
import { getCompInit, copyMerge } from '#rx'
import type { MassState } from '#mass/types/mass'
import { getDefaultAIProjectAdminSettings } from './defaults'
import { Model } from './model/Model'
import { ProjectAdminRender } from './view/ProjectAdminRender'
import { AIProjectAdminInteractions } from './interactions/AIProjectAdminInteractions'
import { CreateProjectRender } from './view/CreateProjectRender'
import { sayerror } from '#dom'

class AIProjectAdmin extends RxComponentInner {
	public type = 'AIProjectAdmin'
	model: Model
	projects?: any[]
	prjtAdminUI?: ProjectAdminRender
	interactions?: AIProjectAdminInteractions

	constructor(opts: any) {
		super()
		this.opts = opts
		this.dom = {
			holder: opts.holder,
			errorDiv: opts.holder.append('div').style('padding', '3px').attr('class', 'sjpp-ai-prjt-admin-error')
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
		this.interactions = new AIProjectAdminInteractions(this.app, this.id, this.model)

		try {
			this.projects = await this.model.getProjects(appState.vocab.genome, appState.vocab.dslabel)
		} catch (e: any) {
			console.error('Error initializing AIProjectAdmin:', e)
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

		this.dom.holder.selectAll('.sjpp-deletable-ai-prjt-admin-div').remove()

		if (config.settings.project.type === 'new') {
			const terms = await this.model.getTerms(state.vocab, this.app)
			if (!terms || terms.length === 0) {
				sayerror(this.dom.errorDiv, 'No metadata found.')
				return
			}
			const createProjectRender = new CreateProjectRender(this.dom, this.app)
			createProjectRender.render()
		}
	}
}

export const aiProjectAdminInit = getCompInit(AIProjectAdmin)
export const componentInit = aiProjectAdminInit

export async function getPlotConfig(opts: any) {
	const config = {
		chartType: 'AIProjectAdmin',
		subfolder: 'aiProjectAdmin',
		extension: 'ts',
		settings: getDefaultAIProjectAdminSettings(opts.overrides)
	}

	return copyMerge(config, opts)
}
