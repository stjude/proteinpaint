import { RoutePayload } from './routeApi.js'

export type TermdbCohortsRequest = any
export type TermdbCohortsResponse = any

export const termdbCohortsPayload: RoutePayload = {
	request: {
		typeId: 'TermdbCohortsRequest'
	},
	response: {
		typeId: 'TermdbCohortsResponse'
	}
	//examples: []
}
