import type { Model } from '../model/Model'

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
		const config = this.app.getState().plots.find((p: any) => p.id === this.id)

		const projectObject = Object.assign({}, config.settings.project, opts.project)

		const body = {
			genome: this.genome,
			dslabel: this.dslabel,
			project: projectObject
		}

		try {
			await this.model.updateProject(body, 'put')
		} catch (e) {
			console.error('Error adding project:', e)
			throw e
		}
	}

	async editProject(filter: string, classes: any[]) {
		const config = this.app.getState().plots.find((p: any) => p.id === this.id)

		const project = Object.assign({}, config.settings.project, {
			type: 'edit',
			filter: JSON.stringify(filter),
			classes
		})

		const body = {
			genome: this.genome,
			dslabel: this.dslabel,
			project
		}
		try {
			await this.model.updateProject(body, 'post')
		} catch (e) {
			console.error('Error editing project:', e)
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
			await this.model.updateProject(body, 'delete')
		} catch (e) {
			console.error('Error deleting project:', e)
			throw e
		}
	}

	async appDispatchEdit(settings: any, config: any = {}) {
		if (!config?.settings) {
			config = this.app.getState().plots.find((p: any) => p.id === this.id)
			if (!config) throw new Error(`No plot with id='${this.id}' found.`)
		}
		await this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config: Object.assign(settings, config.settings)
		})
	}
}
