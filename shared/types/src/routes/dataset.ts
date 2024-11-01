import type { RoutePayload } from './routeApi'

export type DatasetRequest = any
export type DatasetResponse = any

export const datasetPayload: RoutePayload = {
	request: {
		typeId: 'DatasetRequest'
	},
	response: {
		typeId: 'DatasetResponse'
	}
	// examples: []
}
