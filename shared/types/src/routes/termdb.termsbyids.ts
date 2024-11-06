import type { RoutePayload } from './routeApi.js'
import type { TermWrapper } from '../terms/tw.ts'

export type TermsByIdsRequest = {
	/** a user-defined genome label in the serverconfig.json, hg38, hg19, mm10, etc */
	genome: string
	/** a user-defined dataset label in the serverconfig.json, such as ClinVar, SJLife, GDC, etc */
	dslabel: string
	embedder: string
	/** term id string */
	ids: string[]
}

export type TermsByIdsResponse = {
	terms: { [id: string]: TermWrapper }
}

export const termsByIdsPayload: RoutePayload = {
	request: {
		typeId: 'TermsByIdsRequest'
	},
	response: {
		typeId: 'TermsByIdsResponse'
	}
	// examples: []
}
