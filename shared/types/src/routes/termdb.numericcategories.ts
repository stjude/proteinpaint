import type { RoutePayload } from './routeApi.js'
import type { Filter } from '../filter.ts'

export type NumericCategoriesRequest = {
	/** a user-defined genome label in the serverconfig.json, hg38, hg19, mm10, etc */
	genome: string
	/** a user-defined dataset label in the serverconfig.json, such as ClinVar, SJLife, GDC, etc */
	dslabel: string
	embedder: string
	/** term id string */
	tid: string
	filter?: Filter
}

interface entries {
	value: number
	samplecount: number
}

export type NumericCategoriesResponse = {
	lst: entries[]
}

export const numericCategoriesPayload: RoutePayload = {
	request: {
		typeId: 'NumericCategoriesRequest'
	},
	response: {
		typeId: 'NumericCategoriesResponse'
	},
	// examples: []
}
