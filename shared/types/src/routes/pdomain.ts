import type { RoutePayload } from './routeApi.ts'

export type PdomainRequest = any
export type PdomainResponse = any

export const pdomainPayload: RoutePayload = {
	request: {
		typeId: 'PdomainRequest'
	},
	response: {
		typeId: 'PdomainResponse'
	}
	//examples: []
}
