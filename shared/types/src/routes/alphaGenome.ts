import type { RoutePayload } from './routeApi.ts'

export type alphaGenomeRequest = {
	chromosome: string
	position: number
	reference: string
	alternate: string
	ontologyTerm: string
}

export type alphaGenomeResponse = {
	/** the alpha genome plot */
	plotImage: string
}

export const alphaGenomePayload: RoutePayload = {
	request: {
		typeId: 'alphaGenomeRequest'
	},
	response: {
		typeId: 'alphaGenomeResponse'
	}
}
