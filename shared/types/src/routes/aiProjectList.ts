import type { RoutePayload } from './routeApi.ts'

export type AIProjectListRequest = {
	genome: string
	dslabel: string
}

export type AIProjectListResponse = {
	status: 'ok' | 'error'
	error?: string
}

export const aiProjectListPayload: RoutePayload = {
	request: {
		typeId: 'AIProjectListRequest'
	},
	response: {
		typeId: 'AIProjectListResponse'
	}
}
