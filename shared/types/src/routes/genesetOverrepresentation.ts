export type genesetOverrepresentationRequest = {
	/**  Sample genes to be queried */
	sample_genes: string
	/** Background genes against which the sample genes will be queried. if missing will use all protein-coding genes, available in gene db */
	background_genes?: string
	/** Genome build */
	genome: string
	/** msigdb branch term name. all genesets under this branch will be analyzed */
	geneSetGroup: string
	/** Boolean variable describing if non-coding genes should be filtered */
	filter_non_coding_genes: boolean
}

export type genesetOverrepresentationResponse = {
	/** Name of pathway */
	pathway_name: string
	/** Original p-value */
	p_value_original: number
	/** Adjusted p-value */
	p_value_adjusted: number
}

export type gene_overrepresentation_input = {
	/** Input sample genes */
	sample_genes: string
	/** Input background genes */
	background_genes?: string
	/** Path to msigdb */
	msigdb: string
	/** Name of Gene Set Group */
	gene_set_group: string
	/** Path to gene db */
	genedb: string
	/** Boolean variable describing if non-coding genes should be filtered */
	filter_non_coding_genes: boolean
}
