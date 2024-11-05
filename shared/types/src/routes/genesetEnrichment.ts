import type { RoutePayload } from './routeApi.js'

export type GenesetEnrichmentRequest = {
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
	/** Pickle file to be queried for generating gsea image of a particular geneset */
	pickle_file?: string
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

type gsea_result = {
	/** array of pathway_attributes */
	data: pathway_attributes[]
	/** file name of pickle file containing the stored gsea result in cache directory */
	pickle_file: string
}

/** Pass gsea image to client side */
type gsea_image = any

export type GenesetEnrichmentResponse = {
	/** gsea result or an image (for plotting) is sent to client side */
	pathway: gsea_result | gsea_image
}

export const genesetEnrichmentPayload: RoutePayload = {
	request: {
		typeId: 'GenesetEnrichmentRequest'
	},
	response: {
		typeId: 'GenesetEnrichmentResponse'
	}
	//examples: []
}
