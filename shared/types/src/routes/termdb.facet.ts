import type { Filter } from '../filter.ts'
import type { TermWrapper } from '../terms/tw.ts'

export type TermdbFacetRequest = {
	/** Ref genome */
	genome: string
	/** Ds label */
	dslabel: string
	/** Name of a facet in ds.queries.trackLst.facets[] */
	facetname: string
	/** pp filter */
	filter?: Filter
	/** Optional terms to return per-sample annotations for */
	twLst?: TermWrapper[]
}

export type TermdbFacetResponse = {
	/** Tracks from the requested facet, optionally filtered by sample */
	tracks: any[]
	/** Optional per-sample term annotations, keyed by sample name then term wrapper id */
	samples?: { [sampleName: string]: { [twId: string]: any } }
}

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
