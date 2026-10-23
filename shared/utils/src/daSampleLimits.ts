/** Sample limits of the differential analyses (DE, DM and splicing), in one place so that the client, which offers
 * only what is allowed, and the server, which refuses a request past them, agree. The server counts the samples
 * that have data, after the groups are resolved. */

/** The most samples that one run may compare, both groups together */
export const maxSampleCutoff = 4000

/** The most samples that one differential expression run may compare, by method. At 500 samples on ASH, limma needs
 * ~2.2 GB and edgeR ~1.9 GB; wilcoxon needs ~0.45 MB per sample, ~1.9 GB at 3,000, so each fits under DE's own memory
 * ceiling (DE_MAX_MB in termdb.DE.ts) at its limit. A dataset may set a lower limit for every method
 * (queries.rnaseqGeneCount.maxSamples), not a higher one. */
export const deMethodSampleLimits: Record<string, number> = { edgeR: 500, limma: 500, wilcoxon: 3000 }

/** The sample limit of a DE run by `method`, at most `dsMaxSamples`, the dataset's own limit, when it sets one. With no
 * `method`, the limit of the method that allows the most: whether any method may run. A method not in
 * deMethodSampleLimits gets the lowest limit. */
export function deSampleLimit(method?: string, dsMaxSamples?: number): number {
	const limits = Object.values(deMethodSampleLimits)
	const own = method == undefined ? Math.max(...limits) : deMethodSampleLimits[method] ?? Math.min(...limits)
	return Math.min(own, dsMaxSamples || Infinity)
}

/** The alert for a run of `total` samples over `limit`, or '' when it is within it. `limit` is maxSampleCutoff, or
 * the limit of the analysis or the dataset; `noun` is the dataset's label for samples, e.g. 'cases'. */
export function sampleLimitAlert(total: number, noun = 'samples', limit = maxSampleCutoff): string {
	return total > limit
		? `${total} ${noun} selected exceeds the limit of ${limit} per run. Please narrow the cohort.`
		: ''
}
