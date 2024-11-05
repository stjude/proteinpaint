import type { RoutePayload } from './routeApi.js'

export type NtseqRequest = any
export type NtseqResponse = any

export const ntseqPayload: RoutePayload = {
	request: {
		typeId: 'NtseqRequest'
	},
	response: {
		typeId: 'NtseqResponse'
	}
	//examples: []
}
