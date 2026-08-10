import type { DERequest } from './termdb.DE.js'
import type { DiffMethRequest } from './termdb.diffMeth.js'

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
	daRequest?: Partial<DERequest> | Partial<DiffMethRequest>
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
	/** DAP-specific parameters: organism/assay/cohort identify the DAP file */
	dapParams?: { organism: string; assay: string; cohort: string }
}

/** blitzgsea's own column names, passed straight through by python/src/gsea.py (result.to_json()),
so this must keep spelling them the way blitzgsea does -- notably `pval`, not `pvalue`.
`nes` may arrive as the string 'Infinity'/'-Infinity': blitzgsea computes it as the normal quantile
of the permutation p-value, so a p-value that underflows its gamma fit puts the score off the scale.
JSON has no Infinity literal and pandas' to_json() writes null for inf and NaN alike, which would
make "off the scale" indistinguishable from "not computed", so gsea.py sends those two as strings. */
type blitzgsea_geneset_attributes = {
	/** Absolute enrichment score */
	es: number
	/** Normalized enrichment score. 'Infinity'/'-Infinity' when the p-value underflowed */
	nes: number | 'Infinity' | '-Infinity'
	/** Size of gene set */
	geneset_size: number
	/** Leading edge genes */
	leading_edge: string
	/** pvalue */
	pval: number
	/** sidak (multiple testing correction) */
	sidak: number
	/** false discovery rate */
	fdr: number
}

// Key value pair of geneset name and blitzgsea geneset attributes
type blitzgsea_map = {
	[geneset_name: string]: blitzgsea_geneset_attributes
}

/** field names come from rust/src/cerno.rs output_struct, which also spells it `pval` */
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
	pval: number
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

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
