import type { RoutePayload } from './routeApi.js'

export type DsDataRequest = any
export type DsDataResponse = any

export const dsDataPayload: RoutePayload = {
	request: {
		typeId: 'DsDataRequest'
	},
	response: {
		typeId: 'DsDataResponse'
	}
	// examples: []
}
