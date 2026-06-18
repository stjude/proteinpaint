export type GseaSettings = {
	/** False discovery rate threshold used when selecting by FDR. */
	fdr_cutoff: number
	/** Number of permutations to run for permutation-based significance estimation. */
	num_permutations: number
	/** Number of top gene sets to return when selecting by rank. */
	top_genesets: number
	/** Optional pathway library identifier to scope the analysis. */
	pathway?: string
	/** Optional specific gene set name to focus the analysis on. */
	geneset_name?: string | null
	/** Minimum allowed size of a gene set. */
	min_gene_set_size_cutoff: number
	/** Maximum allowed size of a gene set. */
	max_gene_set_size_cutoff: number
	/** Whether to exclude non-coding genes before running enrichment. */
	filter_non_coding_genes: boolean
	/** Strategy for selecting reported results: by FDR threshold or top-ranked sets. */
	fdr_or_top: 'fdr' | 'top'
	/** GSEA algorithm implementation to run. */
	gsea_method: 'blitzgsea' | 'cerno'
}
