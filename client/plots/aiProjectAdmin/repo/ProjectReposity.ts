import { dofetch2, dofetch3 } from '#common/dofetch'
import type { AIProjectAdminRequest, AIProjectAdminResponse } from '#types'

export class ProjectReposity {
	public async getProjects(genome: string, dslabel: string): Promise<string[]> {
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

	/** Gets the image paths from db */
	public async getImages(genome: string, dslabel: string, project: any): Promise<string[]> {
		const body: AIProjectAdminRequest = {
			genome,
			dslabel,
			for: 'images',
			project
		}
		try {
			const response = await dofetch3('aiProjectAdmin', { body })
			return response || []
		} catch (error) {
			console.error('Error fetching images:', error)
			throw error
		}
	}

	public async updateProject(_body: any, method: string): Promise<AIProjectAdminResponse> {
		const body: AIProjectAdminRequest = Object.assign({}, _body, { for: 'admin' })
		try {
			if (method == 'PUT' || method == 'DELETE') {
				/** 3rd argument is for serverData caching.
				 * Do not cache put or delete requests */
				return await dofetch2('aiProjectAdmin', { method, body }, {})
			}
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
