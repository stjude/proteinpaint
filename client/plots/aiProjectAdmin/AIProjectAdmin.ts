import { RxComponentInner } from '../../types/rx.d'
import { getCompInit, copyMerge } from '#rx'
import type { MassState } from '#mass/types/mass'
import { getDefaultAIProjectAdminSettings } from './defaults'
import { ProjectReposity } from './repo/ProjectReposity'
import { ProjectAdminRender } from './view/ProjectAdminRender'
import { AIProjectAdminInteractions } from './interactions/AIProjectAdminInteractions'
import { CreateProjectRender } from './view/CreateProjectRender'
import { sayerror } from '#dom'

/** This plot supports training AI models.
 * The UI allows users to create and manage projects. */

class AIProjectAdmin extends RxComponentInner {
	public type = 'AIProjectAdmin'
	prjtRepo: ProjectReposity
	projects?: any[]
	prjtAdminUI?: ProjectAdminRender
	interactions?: AIProjectAdminInteractions

	constructor(opts: any) {
		super()
		this.opts = opts
		this.dom = {
			holder: opts.holder,
			errorDiv: opts.holder.append('div').style('margin', '3px').attr('class', 'sjpp-ai-prjt-admin-error')
		}
		if (opts.header) this.dom.header = opts.header

		this.prjtRepo = new ProjectReposity()
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: any) => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config,
			vocab: appState.vocab,
			filter: appState.termfilter.filter
		}
	}

	async init(appState: MassState) {
		this.interactions = new AIProjectAdminInteractions(this.app, this.id, this.prjtRepo)

		try {
			this.projects = await this.prjtRepo.getProjects(appState.vocab.genome, appState.vocab.dslabel)
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

		if (!this.interactions) throw new Error('AIProjectAdminInteractions not initialized')

		this.dom.holder.selectAll('.sjpp-deletable-ai-prjt-admin-div').remove()

		if (config.settings.project.type === 'new') {
			const terms = await this.prjtRepo.getTerms(this.app)
			if (!terms || terms.length === 0) {
				sayerror(this.dom.errorDiv, 'No metadata found.')
				return
			}
			const createProjectRender = new CreateProjectRender(this.dom, this.app, this.interactions)
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
