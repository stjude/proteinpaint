import { dofetch3 } from '#common/dofetch'
import type { AIProjectAdminRequest } from '#types'

export class Model {
	public static async getProjects(genome: string, dslabel: string): Promise<any[]> {
		const body: AIProjectAdminRequest = {
			genome,
			dslabel,
			for: 'list'
		}
		try {
			const response = await dofetch3('aiProjectAdmin', { body })
			return response || []
		} catch (error) {
			console.error('Error fetching projects:', error)
			throw error
		}
	}

	public static async updateProject(_body: any, method: string): Promise<any> {
		const body: AIProjectAdminRequest = Object.assign({}, _body, { for: 'admin' })
		try {
			return await dofetch3('aiProjectAdmin', { method, body })
		} catch (error) {
			console.error('Error fetching projects:', error)
			throw error
		}
	}

	//TODO: Will need a method to call metadata API, then build dictionary
	async getTerms(app: any): Promise<any> {
		const root = { id: '__root', name: 'root', __tree_isroot: true }
		try {
			await app.vocabApi.buildAdHocDictionary()
			const terms = await app.vocabApi.getTermChildren(root, [])
			return terms || []
		} catch (error) {
			console.error('Error getting terms:', error)
			throw error
		}
	}
}
