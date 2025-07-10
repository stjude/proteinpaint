import type { RoutePayload } from './routeApi.ts'

export type AIHistoListRequest = {
	index: number
	confirmed: boolean
	class: number | null
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
