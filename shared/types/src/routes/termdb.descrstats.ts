import type { RoutePayload } from './routeApi.js'
import type { Filter } from '../filter.ts'
import type { TermWrapper } from '../terms/tw.ts'

export type DescrStatsRequest = {
	/** genome label in the serverconfig.json */
	genome: string
	/** dataset label for the given genome */
	dslabel: string
	embedder: string
	/** wrapper of a numeric term, q.mode can be any as getData() will always pull sample-level values for summarizing */
	tw: TermWrapper
	/** if true, the (violin) plot is in log scale and must exclude 0-values from the stat */
	logScale?: boolean
	/** optional pp filter */
	filter?: Filter
	/** optional gdc filter */
	filter0?: any
	__protected__?: any //reuse definition from termdb.matrix.ts!!!
}

export type DescrStats = {
	[key: string]: {
		key: string
		label: string
		value: number
	}
}

export type DescrStatsResponse = DescrStats

export const descrStatsPayload: RoutePayload = {
	request: {
		typeId: 'DescrStatsRequest'
	},
	response: {
		typeId: 'DescrStatsResponse'
	},
	examples: [
		{
			request: {
				body: {
					genome: 'hg38-test',
					dslabel: 'TermdbTest',
					embedder: 'localhost',
					tw: { term: { id: 'hrtavg' }, q: { mode: 'continuous' } },
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
