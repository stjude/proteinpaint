import type { RoutePayload } from './routeApi.js'
import type { DERequest } from './termdb.DE.js'

export type GenesetEnrichmentRequest = {
	/** Sample genes to be queried. Optional when `cacheId` is given — the
	 * server loads genes from the DE cache file in that case. */
	genes?: string[]
	/** Fold changes aligned to `genes`. Optional when `cacheId` is given. */
	fold_change?: number[]
	/** DE cache ID (returned by the volcano/DE route). Deterministic hash
	 * of the DE inputs. If set, the server reads genes + fold_change from
	 * the cache file and ignores any `genes`/`fold_change` fields sent in
	 * this request. */
	cacheId?: string
	/** Snapshot of the original DE request that produced `cacheId`. When
	 * the cache file is missing (TTL eviction or farm node that has never
	 * seen this request), the server uses this to recompute and rewrite
	 * the cache. Without this field, a cache miss is unrecoverable. */
	/** Dataset label forwarded for auth middleware / dataset scoping. */
	dslabel?: string
	/** Snapshot of the original DE request that produced `cacheId`. When
	 * the cache file is missing (TTL eviction or farm node that has never
	 * seen this request), the server uses this to recompute and rewrite
	 * the cache. Without this field, a cache miss is unrecoverable.
	 * This mirrors the partial DE payload shape sent by clients. */
	daRequest?: Partial<DERequest>
	fetchDE?: boolean
	/** Filter non-coding genes */
	filter_non_coding_genes: boolean
	/** Genome build */
	genome: string
	/** Type of GO to be queried e.g MF, CC, BP */
	geneSetGroup: string
	/** Gene set name whose enrichment score is to be profiled */
	geneset_name?: string
	/** Number of permutations to be carried out for GSEA analysis.
	 * Only read by the blitzgsea path; cerno and fetchDE requests omit it. */
	num_permutations?: number
	/** Method used for GSEA blitzgsea/cerno */
	method: 'blitzgsea' | 'cerno'
}

type blitzgsea_geneset_attributes = {
	/** Absolute enrichment score */
	es: number
	/** Normalized enrichment score */
	nes: number
	/** Size of gene set */
	geneset_size: number
	/** Leading edge genes */
	leading_edge: string
	/** pvalue */
	pvalue: number
	/** sidak (multiple testing correction) */
	sidak: number
	/** false discovery rate */
	fdr: number
}

// Key value pair of geneset name and blitzgsea geneset attributes
type blitzgsea_map = {
	[geneset_name: string]: blitzgsea_geneset_attributes
}

type cerno_geneset_attributes = {
	/** Absolute enrichment score */
	es: number
	/** Area under curve score */
	auc: number
	/** Size of gene set */
	geneset_size: number
	/** Leading edge genes */
	leading_edge: string
	/** pvalue */
	pvalue: number
	/** false discovery rate */
	fdr: number
}

type blitzgsea_json = {
	/** array of pathway_attributes */
	data: blitzgsea_map[]
}

// Key value pair of geneset name and cerno geneset attributes
type cerno_map = {
	[geneset_name: string]: cerno_geneset_attributes
}

/** Pass gsea image to client side */
type blitzgsea_image_name = string

type blitzgseaResult = {
	pathway: blitzgsea_json | blitzgsea_image_name
}

type cernoResult = {
	data: cerno_map[]
}

export type GenesetEnrichmentResponse = {
	/** gsea result or an image (for plotting) is sent to client side */
	data: blitzgseaResult | cernoResult
}

export const genesetEnrichmentPayload: RoutePayload = {
	request: {
		typeId: 'GenesetEnrichmentRequest'
	},
	response: {
		typeId: 'GenesetEnrichmentResponse'
	}
	//examples: []
}
