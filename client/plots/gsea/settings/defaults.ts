import type { GseaSettings } from './Settings'
import { DMR_SCAN_ELEMENT_TYPE } from '#types'

/** Whether this GSEA ranks genes by gene-body delta-beta from a DMR scan rather than by a
 * gene-level fold change. The scan has no gene rows, so the server substitutes that ranking
 * (genesetEnrichment.ts) and it needs a tighter gene-set ceiling than the rest. */
function isDmrScanRanking(opts: any): boolean {
	return opts?.gsea_params?.daRequest?.element_type === DMR_SCAN_ELEMENT_TYPE
}

export function getDefaultGseaSettings(overrides = {}, opts: any = {}): GseaSettings {
	const defaults: GseaSettings = {
		fdr_cutoff: 0.05,
		num_permutations: 1000,
		top_genesets: 40,
		pathway: opts?.gsea_params?.pathway ?? undefined,
		geneset_name: null,
		min_gene_set_size_cutoff: 0,
		/* 500 only for a DMR scan's gene-body ranking, where blitzgsea's null fit is unstable above
		it: on that 16,000-gene ranking it returned infinite scores for Reactome sets of 260-500
		genes. Every other caller keeps 20,000, because lowering it for them would silently drop
		large GO and Reactome sets from analyses that have always shown them. The control panel
		moves it either way. */
		max_gene_set_size_cutoff: isDmrScanRanking(opts) ? 500 : 20000,
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
