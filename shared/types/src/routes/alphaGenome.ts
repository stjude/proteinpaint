import type { RoutePayload } from './routeApi.ts'

export type alphaGenomeRequest = {
	genome?: string
	dslabel?: string
	chromosome: string
	position: number
	reference: string
	alternate: string
	ontologyTerms: string[]
	outputType?: number
	interval: number
}

export type alphaGenomeResponse = {
	/** the alpha genome plot */
	plotImage: string
}

export type AlphaGenomeTypesResponse = {
	/** the alpha genome ontology terms supported by the dataset */
	ontologyTerms: any[]
	/** the alpha genome output types */
	outputTypes: any[]
	intervals: number[]
}

export const alphaGenomePayload: RoutePayload = {
	request: {
		typeId: 'alphaGenomeRequest'
	},
	response: {
		typeId: 'alphaGenomeResponse'
	}
}
