/** Types local to the general GRIN2 route (server/src/grin2/).
 * Request/response shapes shared with the client live in #types (shared/types/src/routes/grin2.ts);
 * this file holds the server-internal types. */

/** How a dataset quantifies cnv values; declared at ds.queries.cnv.type. See CnvSegmentQuery in #types. */
export type CnvType = 'log2ratio' | 'segmean' | 'category' | 'copyNumber'

/** One GRIN2 lesion row passed to Python: [sampleName, chrom, start, end, lesionType].
 * start/end are numeric genomic positions (not strings) — see the data-flow comment at the top of main.ts. */
export type Lesion = [string, string, number, number, string]

/** Processing summary produced by processSampleData and surfaced in the response stats + coverage notes.
 * The first six fields are always set; the rest are populated only on the batched GDC path or when a cap
 * is hit. Kept as one named type so runGrin2's stat-row assembly is type-checked (not read off `any`). */
export interface Grin2Processing {
	totalSamples: number
	processedSamples: number
	failedSamples: number
	totalLesions: number
	processedLesions: number
	unprocessedSamples: number
	// unique samples that contributed >=1 lesion to the final result (union across all lesion types).
	// distinct from processedSamples: many cohort cases have no qualifying mutation, so this is smaller.
	samplesWithData?: number
	// set when the batched SNV/indel fetch (GDC) hit maxLesions and skipped some samples' ssm. distinct
	// from the loop cap (unprocessedSamples) because the loop still processed those samples.
	ssmCapReached?: boolean
	ssmSamplesDropped?: number
	// samples whose case returned no open-access SNV/indel (batched GDC path); a coverage note, not the
	// cap. distinct from ssmSamplesDropped (cap-skipped) and from failedSamples (per-sample errors).
	// ssmSamplesNoOpenAccess is the total; the two below break it down for the summary.
	ssmSamplesNoOpenAccess?: number
	// of ssmSamplesNoOpenAccess: samples in controlled-access GDC projects (data exists but isn't open).
	ssmSamplesControlledAccess?: number
	// of ssmSamplesNoOpenAccess: open-access samples that genuinely returned no SNV/indel mutation.
	ssmSamplesNoMutations?: number
	// samples that mapped to no GDC case at all (batched path), so were never queried; counted in neither
	// samplesWithData nor ssmSamplesNoOpenAccess, hence surfaced separately so the cohort tallies reconcile.
	unmatchedSamples?: number
	// cnv analogs of the ssm* fields above (batched GDC cnv fetch). cnvCapReached/cnvSamplesDropped mirror
	// ssmCapReached/ssmSamplesDropped; cnvSamplesNoData is queried samples that returned no cnv segment
	// (cnv segment data is open-access, so there is no controlled-access split like ssm has).
	cnvCapReached?: boolean
	cnvSamplesDropped?: number
	cnvSamplesNoData?: number
	// samples excluded from a data type by the hypermutator cutoff (raw record count over the per-dt
	// cutoff). Per-dt: a sample can be hypermutated for snvindel, cnv, both, or neither.
	ssmSamplesHypermutated?: number
	cnvSamplesHypermutated?: number
	lesionCap?: number
	lesionCounts?: {
		total: number
		byType: Record<string, { count: number; samples: number }>
	}
}

/** grin2/{cacheid}.json. Self-contained: the per-gene rows Rust needs
 * for the Manhattan plot live inside `resultData.geneHits`, so the Rust
 * step opens this file directly. */
export type Grin2CacheResult = {
	resultData: any
	processing: Grin2Processing
}
