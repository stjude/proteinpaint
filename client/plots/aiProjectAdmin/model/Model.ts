import { dofetch3 } from '#common/dofetch'
import type { AIProjectListRequest, AIProjectAdminRequest } from '#types'
import type { ClientCopyGenome } from '../../../types/global'

export class Model {
	constructor() {}

	async getProjects(genome: string, dslabel: string): Promise<any[]> {
		const body: AIProjectListRequest = {
			genome,
			dslabel
		}
		try {
			const response = await dofetch3('aiProjectList', { body })
			return response || []
		} catch (error) {
			console.error('Error fetching projects:', error)
			throw error
		}
	}

	async updateProject(body: AIProjectAdminRequest, method: string): Promise<any> {
		try {
			const response = await dofetch3('aiProjectAdmin', { method, body })
			return response
		} catch (error) {
			console.error('Error fetching projects:', error)
			throw error
		}
	}

	//TODO: Will need a method to call metadata API, then build dictionary
	async getTerms(vocab: { genome: ClientCopyGenome; dslabel: string }, app: any): Promise<any> {
		const body = { dslabel: vocab.dslabel, genome: vocab.genome }
		const root = { id: '__root', name: 'root', __tree_isroot: true }
		try {
			await app.vocabApi.buildAdHocDictionary(body)
			const terms = await app.vocabApi.getTermChildren(root, [])
			return terms || []
		} catch (error) {
			console.error('Error getting terms:', error)
			throw error
		}
	}
}
