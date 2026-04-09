import type { RoutePayload } from './routeApi.js'

export type TermdbProteomeRequest = any
export type TermdbProteomeResponse = any

export const termdbProteomePayload: RoutePayload = {
	request: {
		typeId: 'TermdbProteomeRequest'
	},
	response: {
		typeId: 'TermdbProteomeResponse'
	}
}
