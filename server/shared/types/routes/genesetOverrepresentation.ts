export type genesetOverrepresentationRequest = {
	/**  Sample genes to be queried */
	sample_genes: string
	/** Background genes against which the sample genes will be queried */
	background_genes?: string
	/** Genome build */
	genome: string
	/** Type of GO to be queried e.g MF, CC, BP */
	geneSetGroup: string
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
	gene_db: string
}
