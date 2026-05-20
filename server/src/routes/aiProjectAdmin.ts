import type { RouteApi } from '#types'
import { aiProjectAdminPayload } from '#types/checkers'
import { init } from '../../routes/aiProjectAdmin.ts'

export const api: RouteApi = {
	endpoint: 'aiProjectAdmin',
	methods: {
		get: {
			//all requests
			...aiProjectAdminPayload,
			init
		},
		post: {
			//'admin' -> edit
			...aiProjectAdminPayload,
			init
		},
		delete: {
			//'admin' -> delete
			...aiProjectAdminPayload,
			init
		},
		put: {
			//'admin' -> add
			...aiProjectAdminPayload,
			init
		}
	}
}
