import type { RoutePayload } from './routeApi'

export type DZImagesRequest = {
	genome: string
	dslabel: string
	file: string

	// params: {
	// 	[key: string]: any
	// }
	sampleId?: string
	sample_id?: string
}

export type DZImagesResponse = string

export const dzImagesPayload: RoutePayload = {
	request: {
		typeId: 'DZImagesRequest'
	},
	response: {
		typeId: 'DZImagesResponse'
	}
	// examples: []
}
