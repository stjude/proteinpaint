import type { RoutePayload } from './routeApi.js'

export type GeneLookupRequest = {
	input: string
	genome: string
	deep: boolean
}

export type GeneLookupResponse = {
	error?: string
	hits: string[]
}

export const geneLookupPayload: RoutePayload = {
	request: {
		typeId: 'GeneLookupRequest'
	},
	response: {
		typeId: 'GeneLookupResponse'
	}
	//examples: []
}
