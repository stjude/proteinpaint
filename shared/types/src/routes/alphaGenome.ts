import type { RoutePayload } from './routeApi.ts'

export type alphaGenomeRequest = {
	chromosome: string
	position: number
	reference: string
	alternate: string
	ontologyTerms: string[]
}

export type alphaGenomeResponse = {
	/** the alpha genome plot */
	plotImage: string
}

export type alphaGenomeSampleTypesResponse = {
	/** the alpha genome sample types */
	sampleTypes: string[]
}

export const alphaGenomePayload: RoutePayload = {
	request: {
		typeId: 'alphaGenomeRequest'
	},
	response: {
		typeId: 'alphaGenomeResponse'
	}
}
