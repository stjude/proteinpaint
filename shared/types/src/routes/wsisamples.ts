import type { RoutePayload } from './routeApi.js'

export type WSISamplesRequest = {
	genome: string
	dslabel: string
}

export type WSISamplesResponse = {
	samples: Array<WSISample>
	error?: string
}

export type WSISample = {
	sampleId: string
	wsimages: Array<string>
}

export const wsiSamplesPayload: RoutePayload = {
	request: {
		typeId: 'WSISamplesRequest'
	},
	response: {
		typeId: 'WSISamplesResponse'
	}
}
