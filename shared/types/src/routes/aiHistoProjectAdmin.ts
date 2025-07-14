import type { RoutePayload } from './routeApi.ts'

export type AIHistoProjectAdminRequest = {
	genome: string
	dslabel: string
	projectName: string
	projectId?: number
}

export type AIHistoProjectAdminResponse = {
	status: 'ok' | 'error'
	error?: string
}

export const aiHistoProjectAdminPayload: RoutePayload = {
	request: {
		typeId: 'AIHistoProjectAdminRequest'
	},
	response: {
		typeId: 'AIHistoProjectAdminResponse'
	}
}
