import type { RoutePayload } from './routeApi.js'

export type topMutatedGeneRequest = {
	genome: string
	dslabel: string
	/** to restrict to CGC genes */
	geneFilter?: 'CGC'
	/** max number of genes to return */
	maxGenes?: number
	/** pp filter */
	filter?: object
	/** gdc cohort filter */
	filter0?: object
	snv_mfndi?: string
	snv_splice?: string
	snv_utr?: string
	snv_s?: string
	sv?: string
	fusion?: string
}

export type MutatedGene = {
	/** gene symbol */
	gene: string
	/** optional attributes on number of mutated cases per dt */
	mutationStat?: {
		/** each stat object is identified by either dt or class */
		dt?: number
		class?: string
		/** number of samples with alterations of this gene */
		count: number
	}[]
}

export type topMutatedGeneResponse = {
	genes: MutatedGene[]
}

export const topMutatedGenePayload: RoutePayload = {
	request: {
		typeId: 'topMutatedGeneRequest'
	},
	response: {
		typeId: 'topMutatedGeneResponse'
	}
	//examples: []
}
