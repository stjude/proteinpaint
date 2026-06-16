/** Types local to the general GRIN2 route (server/src/grin2/).
 * Request/response shapes shared with the client live in #types (shared/types/src/routes/grin2.ts);
 * this file holds the server-internal types. */

/** How a dataset quantifies cnv values; declared at ds.queries.cnv.type. See CnvSegmentQuery in #types. */
export type CnvType = 'log2ratio' | 'segmean' | 'category' | 'copyNumber'

/** grin2/{cacheid}.json. Self-contained: the per-gene rows Rust needs
 * for the Manhattan plot live inside `resultData.geneHits`, so the Rust
 * step opens this file directly. */
export type Grin2CacheResult = {
	resultData: any
	processing: any
}
