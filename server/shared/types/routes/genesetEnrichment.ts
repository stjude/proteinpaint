export type genesetEnrichmentRequest = {
	/** Sample genes to be queried */
	genes: string[]
	/** Background genes against which the sample genes will be queried */
	fold_change: number[]
	/** Genome build */
	genome: string
	/** Type of GO to be queried e.g MF, CC, BP */
	geneSetGroup: string
	/** Gene set name whose enrichment score is to be profiled */
	geneset_name?: string
}

type pathway_attributes = {
	/** Absolute enrichment score */
	es: number
	/** Normalized enrichment score */
	nes: number
	/** Size of gene set */
	geneset_size: number
	/** Leading edge genes */
	leading_edge: string
	/** pvalue */
	pvalue: number
	/** sidak (multiple testing correction) */
	sidak: number
	/** false discovery rate */
	fdr: number
}

export type genesetEnrichmentResponse = {
	/** array of pathway_attributes or any where an image (for plotting) is sent to client side */
	pathway: pathway_attributes[] | any
}
