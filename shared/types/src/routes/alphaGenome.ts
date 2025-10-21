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

export const alphaGenomePayload: RoutePayload = {
	request: {
		typeId: 'alphaGenomeRequest'
	},
	response: {
		typeId: 'alphaGenomeResponse'
	}
}
