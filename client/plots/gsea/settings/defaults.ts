import type { GseaSettings } from './Settings'

export function getDefaultGseaSettings(overrides = {}, opts: any = {}): GseaSettings {
	const defaults: GseaSettings = {
		fdr_cutoff: 0.05,
		num_permutations: 1000,
		top_genesets: 40,
		pathway: opts?.gsea_params?.pathway ?? undefined,
		geneset_name: null,
		min_gene_set_size_cutoff: 0,
		/* 500 is the conventional GSEA ceiling. Above it a set is a compartment rather than a
		pathway, and blitzgsea's null fit is unstable there: on a 16,000-gene ranking it returned
		infinite scores for Reactome sets of 260-500 genes. The control panel raises it when a
		reader wants them. */
		max_gene_set_size_cutoff: 500,
		filter_non_coding_genes: true,
		fdr_or_top: 'top',
		gsea_method: 'blitzgsea'
	}
	if (JSON.parse(sessionStorage.getItem('optionalFeatures') || '{}')?.gsea_test) {
		// set default method to CERNO when serverconfig flag gsea_test is defined
		defaults.gsea_method = 'cerno'
	}
	return Object.assign(defaults, overrides)
}
