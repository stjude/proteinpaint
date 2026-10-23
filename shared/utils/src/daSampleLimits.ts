/** Sample limits of the differential analyses (DE, DM and splicing), in one place so that the client, which offers
 * only what is allowed, and the server, which refuses a request past them, agree. The server counts the samples
 * that have data, after the groups are resolved. */

/** The most samples that one run may compare, both groups together */
export const maxSampleCutoff = 4000

/** The most samples that one differential expression run may compare, by any method. A dataset may set a lower limit
 * (queries.rnaseqGeneCount.maxSamples), not a higher one. At 500 samples, the R methods need ~2.2 GB on ASH. */
export const maxDESampleCutoff = 500

/** The alert for a run of `total` samples over `limit`, or '' when it is within it. `limit` is maxSampleCutoff, or
 * the limit of the analysis or the dataset; `noun` is the dataset's label for samples, e.g. 'cases'. */
export function sampleLimitAlert(total: number, noun = 'samples', limit = maxSampleCutoff): string {
	return total > limit
		? `${total} ${noun} selected exceeds the limit of ${limit} per run. Please narrow the cohort.`
		: ''
}
