import type { ProjectReposity } from '../repo/ProjectReposity'
import type { AIProjectAdminResponse } from '#types'

export class AIProjectAdminInteractions {
	app: any
	id: string
	genome: string
	dslabel: string
	prjtRepo: ProjectReposity

	constructor(app: any, id: string, prjtRepo: ProjectReposity) {
		this.app = app
		this.id = id
		this.genome = app.vocabApi.vocab.genome
		this.dslabel = app.vocabApi.vocab.dslabel
		this.prjtRepo = prjtRepo
	}

	async addProject(opts: { project: any }) {
		const config = this.getConfig()
		const projectObject = Object.assign({}, config.settings.project, opts.project)

		const body = {
			genome: this.genome,
			dslabel: this.dslabel,
			project: projectObject
		}
		try {
			await this.prjtRepo.updateProject(body, 'PUT')
		} catch (e: any) {
			console.error('Error adding project:', e.message || e)
			throw e
		}
	}

	public async editProject(opts: { project: any }) {
		const config = this.getConfig()
		const project = Object.assign(
			{},
			config.settings.project,
			{
				type: 'edit'
			},
			opts.project
		)

		const body = {
			genome: this.genome,
			dslabel: this.dslabel,
			project
		}
		try {
			await this.prjtRepo.updateProject(body, 'POST')
		} catch (e: any) {
			console.error('Error editing project:', e.message || e)
			throw e
		}
		this.appDispatchEdit({ settings: { project } }, config)
	}

	async deleteProject(project: { value: string; id: number }) {
		const body = {
			genome: this.genome,
			dslabel: this.dslabel,
			project: {
				name: project.value,
				id: project.id
			}
		}

		try {
			await this.prjtRepo.updateProject(body, 'DELETE')
		} catch (e: any) {
			console.error('Error deleting project:', e.message || e)
			throw e
		}
	}

	async getImages(filter: any): Promise<AIProjectAdminResponse> {
		const config = this.getConfig()
		return await this.app.vocabApi.getAiImages(config.settings.project, filter)
	}

	public async appDispatchEdit(settings: any, config: any = {}) {
		if (!config?.settings) {
			config = this.getConfig()
			if (!config) throw new Error(`No plot with id='${this.id}' found.`)
		}
		await this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config: Object.assign(settings, config.settings)
		})
	}

	private getConfig() {
		return this.app.getState().plots.find((p: any) => p.id === this.id)
	}
}
