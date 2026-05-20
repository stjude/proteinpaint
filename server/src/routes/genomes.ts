import { init } from '../../routes/genomes.ts'

export const api: any = {
	endpoint: 'genomes',
	methods: {
		get: {
			init,
			request: {
				typeId: 'any'
			},
			response: {
				typeId: 'any'
			}
		},
		post: {
			alternativeFor: 'get',
			init
		}
	}
}
