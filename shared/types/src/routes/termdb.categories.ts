import type { RoutePayload } from './routeApi.js'
import type { Filter } from '../filter.ts'
import type { TermWrapper } from '../terms/tw.ts'

export type CategoriesRequest = {
	genome: string
	dslabel: string
	embedder: string
	/** termwrapper object */
	tw: TermWrapper
	filter?: Filter
	filter0?: any
	/** quick fix only for gdc */
	currentGeneNames?: string[]
	/** optional property added by mds3 tk, to limit to cases mutated in this region */
	rglst?: any
}

interface Entries {
	samplecount: number
	key: string
	label: string
}

export type CategoriesResponse = {
	lst: Entries[]
	orderedLabels?: []
}

export const termdbCategoriesPayload: RoutePayload = {
	request: {
		typeId: 'CategoriesRequest'
	},
	response: {
		typeId: 'CategoriesResponse'
	},
	examples: [
		{
			request: {
				body: {
					genome: 'hg38-test',
					dslabel: 'TermdbTest',
					embedder: 'localhost',
					term: { id: 'diaggrp' },
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
