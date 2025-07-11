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

	async editProject() {
		// const body = {
		// 	genome: this.genome,
		// 	dslabel: this.dslabel,
		// 	projectName: projectName
		// }
		// try {
		// 	await this.model.updateProject(body, 'post')
		// } catch (e) {
		// 	console.error('Error adding project:', e)
		// 	throw e
		// }
	}

	async deleteProject(project: { value: string; id: number }) {
		const body = {
			genome: this.genome,
			dslabel: this.dslabel,
			projectId: project.id,
			projectName: project.value //Not needed??
		}

		try {
			await this.model.updateProject(body, 'delete')
		} catch (e) {
			console.error('Error deleting project:', e)
			throw e
		}
	}
}
