import { dofetch3 } from '#common/dofetch'
import type { AIHistoListRequest, AIHistoProjectAdminRequest } from '#types'

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
}
