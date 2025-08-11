import { Model } from '../model/Model'
import { dofetch3 } from '#common/dofetch'

export class AIProjectAdminInteractions {
	app: any
	id: string
	genome: string
	dslabel: string
	model: Model

	constructor(app: any, id: string, model: Model) {
		this.app = app
		this.id = id
		this.genome = app.vocabApi.vocab.genome
		this.dslabel = app.vocabApi.vocab.dslabel
		this.model = model
	}

	async addProject(opts) {
		const config = this.getConfig()
		const projectObject = Object.assign({}, config.settings.project, opts.project, opts.project.fitler)

		const body = {
			genome: this.genome,
			dslabel: this.dslabel,
			project: projectObject
		}

		try {
			await Model.updateProject(body, 'put')
		} catch (e: any) {
			console.error('Error adding project:', e.message || e)
			throw e
		}
	}

	public async editProject(filter: string, classes: any[]) {
		const config = this.getConfig()
		const project = Object.assign({}, config.settings.project, {
			type: 'edit',
			filter,
			classes
		})

		const body = {
			genome: this.genome,
			dslabel: this.dslabel,
			project
		}
		try {
			await Model.updateProject(body, 'post')
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
			await Model.updateProject(body, 'delete')
		} catch (e: any) {
			console.error('Error deleting project:', e.message || e)
			throw e
		}
	}

	async getSelections(project, filter) {
		const body = {
			genome: this.genome,
			dslabel: this.dslabel,
			project,
			filter,
			for: 'selections'
		}

		try {
			return await dofetch3('aiProjectAdmin', { method: 'post', body })
		} catch (e: any) {
			console.error('Error getting project selections:', e.message || e)
			throw e
		}
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
