export type genesetEnrichmentRequest = {
	genes: string[] // Sample genes to be queried
	fold_change: number[] // Background genes against which the sample genes will be queried
	genome: string // Genome build
	geneSetGroup: string // Type of GO to be queried e.g MF, CC, BP
}

export type genesetEnrichmentResponse = {
	pathway_name: string // Name of pathway
	p_value_original: number // Original p-value
	p_value_adjusted: number // Adjusted p-value
}
