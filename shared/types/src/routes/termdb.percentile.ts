import type { RoutePayload } from './routeApi.js'
import type { Filter } from '../filter.ts'
import type { Term } from '../terms/term.ts'

export type PercentileRequest = {
	/** a user-defined genome label in the serverconfig.json, hg38, hg19, mm10, etc */
	genome: string
	/** a user-defined dataset label in the serverconfig.json, such as ClinVar, SJLife, GDC, etc */
	dslabel: string
	embedder: string
	getpercentile: number[]
	/** term id string */
	term: Term
	filter?: Filter
	filter0?: any
}

export type PercentileResponse = {
	values: number[]
}

export const percentilePayload: RoutePayload = {
	request: {
		typeId: 'PercentileRequest'
	},
	response: {
		typeId: 'PercentileResponse'
	},
	examples: [
		{
			request: {
				body: {
					genome: 'hg38-test',
					dslabel: 'TermdbTest',
					embedder: 'localhost',
					getpercentile: [50],
					term: { id: 'agedx' },
					filter: {
						type: 'tvslst',
						in: true,
						join: '',
						lst: [
							{
								tag: 'cohortFilter',
								type: 'tvs',
								tvs: {
									term: {
										name: 'Cohort',
										type: 'categorical',
										values: { ABC: { label: 'ABC' }, XYZ: { label: 'XYZ' } },
										id: 'subcohort',
										isleaf: false,
										groupsetting: { disabled: true }
									},
									values: [{ key: 'ABC', label: 'ABC' }]
								}
							}
						]
					}
				}
			},
			response: {
				header: { status: 200 }
			}
		}
	]
}
