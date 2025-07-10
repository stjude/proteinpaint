import { dofetch3 } from '#common/dofetch'

export class Model {
	constructor() {}

	async getProjects(genome: string, dslabel: string): Promise<any[]> {
		const body = {
			genome,
			dslabel
		}

		try {
			const response = await dofetch3('aiHistoList', { body })
			console.log('Fetched projects:', response)
			return response.projects || []
		} catch (error) {
			console.error('Error fetching projects:', error)
			throw error
		}
	}
}
