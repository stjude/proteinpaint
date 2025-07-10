import type { Model } from '../model/Model'

export class AIHistoInteractions {
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

	async addProject(projectName: string) {
		const body = {
			genome: this.genome,
			dslabel: this.dslabel,
			projectName: projectName
		}

		try {
			await this.model.updateProject(body, 'put')
		} catch (e) {
			console.error('Error adding project:', e)
			throw e
		}
	}

	editProject() {
		console.log('Editing project')
	}

	deleteProject() {
		console.log('Deleting project')
	}
}
