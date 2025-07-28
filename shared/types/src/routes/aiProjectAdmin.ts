import type { RoutePayload } from './routeApi.ts'

export type AIProjectAdminRequest = {
	genome: string
	dslabel: string
	projectName: string
	projectId?: number
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
