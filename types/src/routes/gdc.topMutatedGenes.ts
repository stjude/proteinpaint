export type GdcTopMutatedGeneRequest = {
	/** to restrict to CGC genes */
	geneFilter?: 'CGC'
	/** max number of genes to return */
	maxGenes?: number
	/** gdc cohort filter */
	filter0?: object
}

export type Gene = {
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

export type GdcTopMutatedGeneResponse = {
	genes: Gene[]
}
