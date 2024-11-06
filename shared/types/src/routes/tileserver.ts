import type { RoutePayload } from './routeApi.js'

export type TileRequest = any
export type TileResponse = any

export const tilePayload: RoutePayload = {
	request: {
		typeId: 'TileRequest'
	},
	response: {
		typeId: 'TileResponse'
	}
	// examples: []
}
