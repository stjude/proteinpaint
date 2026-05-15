// these are route type definitions that are only known on the server-side,
// the client does not know about them, so do not put this in shared/types

import type { DEImage, DiffMethEntry, GeneDEEntry, GenesetEnrichmentResponse } from '#types'

// these req.query key-values are not submitted from the client
export type ReqQueryAddons = {
	__protected__?: {
		sessionId?: string
		clientAuthResult?: any
		ignoredTermIds?: any
	}
	__abortSignal?: AbortSignal
}

/** ---- Cache results ----
 Each analysis route writes a JSON cache result to its cacheOrRecompute
 subdir (de/, dm/, grin2/, gsea/). The cache result is what survives a
 cache hit — it must carry everything the response builder needs
 without re-running the underlying R/Rust/Python pipeline. */

/** de/{cacheid}.json. Self-contained: gene rows, sample sizes
 * (R-reported for edgeR, group-derived for wilcoxon), engine label, BCV,
 * and — for the edgeR/limma engines — the two diagnostic PNGs already
 * base64-encoded as `DEImage` objects ready to hand to the client. */
export type DeCacheResult = {
	kind: 'DE'
	geneRows: GeneDEEntry[]
	sample_size1: number
	sample_size2: number
	method: string
	bcv?: number
	qlImage?: DEImage
	mdsImage?: DEImage
}

/** dm/{cacheid}.json. Carries the promoter rows and sample sizes —
 * enough for the volcano response on either a fresh run or a cache hit
 * without any extra dataset access. */
export type DmCacheResult = {
	kind: 'DM'
	promoterRows: DiffMethEntry[]
	sample_size1: number
	sample_size2: number
}

/** grin2/{cacheid}.json. Self-contained: the per-gene rows Rust needs
 * for the Manhattan plot live inside `resultData.geneHits`, so the Rust
 * step opens this file directly. */
export type Grin2CacheResult = {
	kind: 'GRIN2'
	resultData: any
	processing: any
}

/** gsea/{cacheid}.json. Self-contained: the blitzgsea result is pickled
 * by Python, base64-encoded, and rides inside this cache result alongside
 * the rendered table. Detail-image requests feed `pickleB64` back to
 * Python via stdin so it can plot a per-geneset running-sum without
 * re-running gsea. */
export type GseaCacheResult = {
	kind: 'GSEA'
	table: GenesetEnrichmentResponse
	pickleB64: string
}
