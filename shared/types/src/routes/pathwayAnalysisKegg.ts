import type { RoutePayload } from './routeApi.ts'

export type PathwayAnalysisKeggRequest = {
	compoundJson: string
	keggid: string
}

export type PathwayAnalysisKeggRequest = {
	keggKgml: string
}

export const patheayAnalysisKeggPayload: RoutePayload = {
	request: {
		typeId: 'PathwayAnalysisKeggRequest'
	},
	response: {
		typeId: 'PathwayAnalysisKeggResponse'
	}
}
