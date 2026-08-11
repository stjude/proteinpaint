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

/** number of samples per mutation class, k: mclass key (e.g. "M") */
type DtClasses = { [mclass: string]: number }

/** an amino acid change (e.g. "G12D") and its sample count, within a mutation class */
export type MnameEntry = {
	mname: string
	class: string
	samplecount: number
	/** gene of this variant, only present when annotated on the mutation data;
	 * distinguishes variants of a geneVariant term with multiple genes */
	gene?: string
}

/** per-dt entry returned for a geneVariant term without groupsetting */
export type GvCategoryEntry = {
	dt: number
	classes: DtClasses | { byOrigin: { [origin: string]: DtClasses } }
	/** amino acid changes present for this dt, sorted by descending sample count.
	 * only served by the termdb/categories route, and only when the mutation data
	 * carries mname; the same entries returned within a data request (see
	 * mayGetCategories() in termdb.matrix.js) omit this field */
	mnames?: MnameEntry[] | { byOrigin: { [origin: string]: MnameEntry[] } }
}

export type CategoriesResponse = {
	lst: Entries[] | GvCategoryEntry[]
	orderedLabels?: []
}

// TODO: write more payload examples to help with automated testing and documentation, for non-prod use only

export const termdbCategoriesPayloadExamples = {
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
					tw: { id: 'diaggrp' },
					filter: {
						type: 'tvslst',
						in: true,
						join: '',
						lst: [
							{
								//tag: 'cohortFilter',
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
				} // satisfies CategoriesRequest // TODO: use the type definition
			},
			response: {
				header: { status: 200 }
			}
		},
		{
			// geneVariant term without groupsetting, returns per-dt entries
			// with classes and mnames (amino acid changes), see GvCategoryEntry
			request: {
				body: {
					genome: 'hg38-test',
					dslabel: 'TermdbTest',
					embedder: 'localhost',
					tw: {
						term: { type: 'geneVariant', name: 'TP53', genes: [{ kind: 'gene', gene: 'TP53' }] },
						q: { type: 'values' }
					}
				}
			},
			response: {
				header: { status: 200 }
			}
		}
	]
}
