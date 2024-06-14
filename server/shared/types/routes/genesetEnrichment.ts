export type genesetEnrichmentRequest = {
	genes: string[] // Sample genes to be queried
	fold_change: number[] // Background genes against which the sample genes will be queried
	genome: string // Genome build
	geneSetGroup: string // Type of GO to be queried e.g MF, CC, BP
}

type pathway_attributes = {
	es: number
	nes: number
	geneset_size: number
	leading_edge: string
	pvalue: number
	sidak: number
	fdr: number
}

export type genesetEnrichmentResponse = {
	pathway: pathway_attributes[]
}
