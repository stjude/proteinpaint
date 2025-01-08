import type { RoutePayload } from './routeApi.ts'

export type ClearWSImagesSessionsRequest = {
	sessions: Array<any>
}

export type ClearWSImagesSessionsResponse = {
	message: string
}

export const clearWSImagesSessionsPayload: RoutePayload = {
	request: {
		typeId: 'ClearWSImagesSessionsRequest'
	},
	response: {
		typeId: 'ClearWSImagesSessionsResponse'
	}
	// examples: []
}
