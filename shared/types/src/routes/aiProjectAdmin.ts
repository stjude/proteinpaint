import type { RoutePayload } from './routeApi.ts'

export type AIProjectAdminRequest = {
	genome: string
	dslabel: string
	/** list: get entire list of projects from db
	 * admin: edit, add, or delete projects from db
	 */
	for: 'list' | 'admin' | 'selections'
	/** required for 'project' and 'selection' requests */
	project?: {
		name: string
		id?: number
		fitler?: string
		classes?: any[]
	}
}

export type AIProjectAdminResponse = {
	status: 'ok' | 'error'
	error?: string
}

export const aiProjectAdminPayload: RoutePayload = {
	request: {
		typeId: 'AIProjectAdminRequest'
	},
	response: {
		typeId: 'AIProjectAdminResponse'
	}
}
