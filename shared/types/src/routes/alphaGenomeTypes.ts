import type { RoutePayload } from './routeApi.ts'

export type alphaGenomeTypesResponse = {
	/** the alpha genome ontology terms supported by the dataset */
	ontologyTerms: any[]
	/** the alpha genome output types */
	outputTypes: any[]
	intervals: number[]
}

export const alphaGenomeTypesPayload: RoutePayload = {
	request: {
		typeId: 'alphaGenomeTypesRequest'
	},
	response: {
		typeId: 'alphaGenomeTypesResponse'
	}
}
