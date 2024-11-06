import type { RoutePayload } from './routeApi.js'

export type TermdbSampleImagesRequest = {
	genome: string
	/** Ds label */
	dslabel: string
	sampleId: number
}

export type Image = {
	src: any
}

export type TermdbSampleImagesResponse = {
	images: Image[]
}

export const termdbSampleImagesPayload: RoutePayload = {
	request: {
		typeId: 'TermdbSampleImagesRequest'
	},
	response: {
		typeId: 'TermdbSampleImagesResponse'
	}
	//examples: []
}
