import type { RoutePayload } from './routeApi.js'

export type SnpRequest = any
export type SnpResponse = any

export const snpPayload: RoutePayload = {
	request: {
		typeId: 'SnpRequest'
	},
	response: {
		typeId: 'SnpResponse'
	}
}
