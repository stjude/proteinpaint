import type { RoutePayload } from './routeApi.ts'

export type PathwayAnalysisIdRequest = {
	genome: string
	dslabel: string
	comlst: []
	selecti: number
}

export type PathwayAnalysisIdResponse = {
	keggids: { [key: string]: string }
}

export const patheayAnalysisIdPayload: RoutePayload = {
	request: {
		typeId: 'PathwayAnalysisIdRequest'
	},
	response: {
		typeId: 'PathwayAnalysisIdResponse'
	}
}
