import type { RoutePayload } from './routeApi.ts'

export type aiHistoProjectAdminRequest = {
	test: 'to come'
}

export type aiHistoProjectAdminResponse = {
	status: 'ok' | 'error'
	error?: string
}

export const aiHistoProjectAdminPayload: RoutePayload = {
	request: {
		typeId: 'aiHistoProjectAdminRequest'
	},
	response: {
		typeId: 'aiHistoProjectAdminResponse'
	}
}
