import type { RoutePayload } from './routeApi.js'

export type TermChildrenRequest = {
	/** a user-defined genome label in the serverconfig.json, hg38, hg19, mm10, etc */
	genome: string
	/** a user-defined dataset label in the serverconfig.json, such as ClinVar, SJLife, GDC, etc */
	dslabel: string
	embedder: string
	get_children: number
	tid: string
}

interface Entries {
	name: string
	id: string
	isleaf: boolean
	included_types: string[]
	child_types: string[]
}

export type TermChildrenResponse = {
	lst: Entries[]
}

export const termChildrenPayload: RoutePayload = {
	request: {
		typeId: 'TermChildrenRequest'
	},
	response: {
		typeId: 'TermChildrenResponse'
	},
	examples: [
		{
			request: {
				body: {
					genome: 'hg38-test',
					dslabel: 'TermdbTest',
					embedder: 'localhost',
					get_children: 1,
					cohortValues: 'ABC',
					tid: 'GO:0000001'
				}
			},
			response: {
				header: { status: 200 }
			}
		}
	]
}
