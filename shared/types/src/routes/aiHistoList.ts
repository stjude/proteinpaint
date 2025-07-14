import type { RoutePayload } from './routeApi.ts'

export type AIHistoListRequest = {
	genome: string
	dslabel: string
}

export type AIHistoListResponse = {
	status: 'ok' | 'error'
	error?: string
}

export const aiHistoListPayload: RoutePayload = {
	request: {
		typeId: 'AIHistoListRequest'
	},
	response: {
		typeId: 'AIHistoListResponse'
	}
}
