import type { RoutePayload } from './routeApi.ts'

export type SampleWSImagesRequest = {
	genome: string
	dslabel: string
	sample_id: string
	wsimage: string
	index: number
}

export type SampleWSImagesResponse = {
	sampleWSImages: WSImage[]
}

export type WSImage = {
	filename: string
	overlays?: Array<string>
	zoomInPoints?: Array<[number, number]>
	metadata: string
	annotationsData?: any
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
