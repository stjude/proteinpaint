export type genesetOverrepresentationRequest = {
	sample_genes: string
	background_genes: string
	genome: string
	geneSetGroup: string
}

export type genesetOverrepresentationResponse = {
	pathway_name: string
	p_value_original: number
	p_value_adjusted: number
}
