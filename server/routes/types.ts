// these are route type definitions that are only known on the server-side,
// the client does not know about them, so do not put this in shared/types

import type { DiffMethEntry, GeneDEEntry, GenesetEnrichmentResponse } from '#types'

// these req.query key-values are not submitted from the client
export type ReqQueryAddons = {
	__protected__?: {
		sessionId?: string
		clientAuthResult?: any
		ignoredTermIds?: any
	}
	__abortSignal?: AbortSignal
}

// ---- Cache envelopes ----
//
// Each analysis route writes a JSON envelope to its cacheOrRecompute
// subdir (de/, dm/, grin2/, gsea/). The envelope is what survives a
// cache hit — it must carry everything the response builder needs
// without re-running the underlying R/Rust/Python pipeline. Cross-process
// artifacts (Python pickles, edgeR PNGs) live as siblings under the same
// subdir; the envelope only references their existence.

/** de/{cacheid}.json. Carries the rows, sample sizes (R-reported for
 * edgeR, group-derived for wilcoxon), the engine label, and BCV. The
 * diagnostic PNGs live as sibling files at de/{cacheid}.ql.png and
 * de/{cacheid}.mds.png — the route handler reads + base64-encodes them
 * for the response. */
export type DeCacheEnvelope = {
	geneRows: GeneDEEntry[]
	sample_size1: number
	sample_size2: number
	method: string
	bcv?: number
}

/** dm/{cacheid}.json. Carries the promoter rows and sample sizes —
 * enough for the volcano response on either a fresh run or a cache hit
 * without any extra dataset access. */
export type DmCacheEnvelope = {
	promoterRows: DiffMethEntry[]
	sample_size1: number
	sample_size2: number
}

/** grin2/{cacheid}.json. The Python txt is a sibling at
 * {cacheid}.python.txt — Rust reads that directly, so the envelope just
 * names the path. The caller (runGrin2) does a pre-check on the sibling
 * and unlinks the envelope if the sibling has been evicted, so the next
 * call misses cleanly and recomputes both. */
export type Grin2Envelope = {
	kind: 'GRIN2'
	pythonCacheFile: string
	resultData: any
	processing: any
}

/** gsea/{cacheid}.json. The pickle is a sibling at {cacheid}.pkl —
 * Python writes both in computeFresh; on cache hit the server reads the
 * table directly out of the envelope and skips Python entirely. The
 * caller pre-checks the pickle's existence and unlinks the envelope if
 * the sibling has been evicted. */
export type GseaEnvelope = {
	kind: 'GSEA'
	table: GenesetEnrichmentResponse
	pickleFile: string
}
