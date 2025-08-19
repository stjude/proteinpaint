import type { RoutePayload } from './routeApi.ts'

export type AIProjectAdminRequest = {
	genome: string
	dslabel: string
	/** list: get entire list of projects from db
	 * admin: edit, add, or delete projects from db
	 */
	for: 'list' | 'admin' | 'images'
	/** required for 'project' and 'selection' requests */
	project?: {
		name: string
		id?: number
		filter?: string
		classes?: any[]
		images?: string[]
	}
}

export type AIProjectAdminResponse =
	| {
			status: 'ok' | 'error'
			error?: string
			data?: { cols: any[]; rows: any[]; images: string[] }[]
	  }
	| string[]

export const aiProjectAdminPayload: RoutePayload = {
	request: {
		typeId: 'AIProjectAdminRequest'
	},
	response: {
		typeId: 'AIProjectAdminResponse'
	}
}
