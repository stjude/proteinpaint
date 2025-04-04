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
	/** rest are arguments for built in query */
	snv_mfndi?: number
	snv_splice?: number
	snv_utr?: number
	snv_s?: number
	sv?: number
	fusion?: number
	cnv?: number
	cnv_ms?: { type: string; geneLst: null }
	cnv_logratio?: { type: string; geneLst: null }
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
