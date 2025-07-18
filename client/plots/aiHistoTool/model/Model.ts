import { dofetch3 } from '#common/dofetch'
import type { AIHistoListRequest, AIHistoProjectAdminRequest } from '#types'
import type { ClientCopyGenome } from '../../../types/global'

export class Model {
	constructor() {}

	async getProjects(genome: string, dslabel: string): Promise<any[]> {
		const body: AIHistoListRequest = {
			genome,
			dslabel
		}
		try {
			const response = await dofetch3('aiHistoList', { body })
			return response || []
		} catch (error) {
			console.error('Error fetching projects:', error)
			throw error
		}
	}

	async updateProject(body: AIHistoProjectAdminRequest, method: string): Promise<any> {
		try {
			const response = await dofetch3('aiHistoProjectAdmin', { method, body })
			return response
		} catch (error) {
			console.error('Error fetching projects:', error)
			throw error
		}
	}

	//TODO: Will need a method to call metadata API, then build dictionary
	async buildDictionary(vocab: { genome: ClientCopyGenome; dslabel: string }, app: any): Promise<void> {
		const body = { dslabel: vocab.dslabel, genome: vocab.genome }
		try {
			await app.vocabApi.buildAdHocDictionary(body)
		} catch (error) {
			console.error('Error building dictionary:', error)
			throw error
		}
	}
}
