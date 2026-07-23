import type { GseaSettings } from './Settings'

export function getDefaultGseaSettings(overrides = {}, opts: any = {}): GseaSettings {
	const defaults: GseaSettings = {
		fdr_cutoff: 0.05,
		num_permutations: 1000,
		top_genesets: 40,
		pathway: opts?.gsea_params?.pathway ?? undefined,
		geneset_name: null,
		min_gene_set_size_cutoff: 0,
		max_gene_set_size_cutoff: 20000,
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
