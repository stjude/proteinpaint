export type GdcTopMutatedGeneRequest = {
	/** to restrict to CGC genes */
	geneFilter?: 'CGC'
	/** max number of genes to return */
	maxGenes?: number
	/** gdc cohort filter */
	filter0?: object
}
export type GdcTopMutatedGeneResponse = {
	genes: string[]
}
