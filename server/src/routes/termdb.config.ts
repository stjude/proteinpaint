import { init } from '../../routes/termdb.config.ts'

export const api: any = {
	endpoint: 'termdb/config',
	methods: {
		get: {
			init,
			request: {
				typeId: 'any'
			},
			response: {
				typeId: 'any'
			}
		}
	}
}
