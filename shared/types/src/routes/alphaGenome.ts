import type { RoutePayload } from './routeApi.ts'

export type alphaGenomeRequest = {
	/** a user-defined genome label in the serverconfig.json, hg38, hg19, mm10, etc */
	genome: string
	/** a user-defined dataset label in the serverconfig.json, such as ClinVar, SJLife, GDC, etc */
	dslabel: string
	chromosome: string
	position: number
	reference: string
	alternate: string
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
