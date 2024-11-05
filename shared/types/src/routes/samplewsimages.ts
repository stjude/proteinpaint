import type { RoutePayload } from './routeApi.ts'

export type SampleWSImagesRequest = {
	genome: string
	dslabel: string
	sample_id: string
	wsimage: string
}

export type SampleWSImagesResponse = {
	sampleWSImages: string[]
}

export type WSImage = {
	filename: string
	metadata: string
}

export const sampleWSImagesPayload: RoutePayload = {
	request: {
		typeId: 'SampleWSImagesRequest'
	},
	response: {
		typeId: 'SampleWSImagesResponse'
	}
	// examples: []
}
