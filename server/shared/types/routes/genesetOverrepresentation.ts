export type genesetOverrepresentationRequest = {
	sample_genes: string // Sample genes to be queried
	background_genes: string // Background genes against which the sample genes will be queried
	genome: string // Genome build
	geneSetGroup: string // Type of GO to be queried e.g MF, CC, BP
}

export type genesetOverrepresentationResponse = {
	pathway_name: string // Name of pathway
	p_value_original: number // Original p-value
	p_value_adjusted: number // Adjusted p-value
}
