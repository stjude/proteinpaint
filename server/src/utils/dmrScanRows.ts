import type { DiffMethEntry, DmrScanSummary, DmrScanYAxis, TermdbDmrBatchSuccessResponse } from '#types'
import { DEFAULT_MIN_CPGS, DMR_SCAN_Y_AXES, clearsMinDeltaBeta } from '#types'

/* Turn a DMR scan (termdb/dmrBatch) into rows the differential-methylation volcano can render,
plus the whole-scan summary its Statistics panel shows.

The scan is presented as one more element class of the DM volcano rather than as its own panel:
every DMR becomes a dot with delta-beta on x and a p on y, and the existing PNG rendering, p-value
table, hover, highlight, download and region drill-down all apply unchanged. What this module owns
is the mapping and the numbers the panel prints, kept pure so both can be checked against a saved
scan without a genome or a dataset. */

// re-exported so callers of this module get the floor and its resolution from one import
export { DEFAULT_MIN_CPGS }

type Dmr = TermdbDmrBatchSuccessResponse['regions'][number]['dmrs'][number]

/** Whether the volcano plots a DMR of minCpgs+ CpGs: it needs a Δβ for x and the chosen region statistic for y. One
 * test for the volcano rows and the region view (termdb/dmr), so neither counts a DMR the other leaves out. */
export function isPlottedDmr(d: Dmr, yAxis: DmrScanYAxis): boolean {
	return d.delta_beta_mean != null && d[yAxis] != null
}

/* A one-chromosome scan is a view of the genome-wide run, not a run of its own. DMRcate calibrates its
smoothed cutoff and its prior over every CpG tested, so a run of one chromosome calls different DMRs:
on DISCOVER chr16 (NM Background vs ATRT SHH) only 68 of 5,787 had the genome-wide run's coordinates,
and the genome-wide run called 2,258 there that it missed. This keeps the run's own calls and counts
only what lies on the chosen chromosomes. */
export function restrictScanPayload(
	run: TermdbDmrBatchSuccessResponse,
	chromosomes: string[]
): TermdbDmrBatchSuccessResponse {
	const keep = new Set(chromosomes)
	const regions = run.regions.filter(r => keep.has(r.chr))
	return {
		...run,
		regions,
		totalProbesAnalyzed: regions.reduce((n, r) => n + (r.n_probes || 0), 0),
		...(run.regionMask
			? {
					regionMask: {
						...run.regionMask,
						dmrsDropped: regions.reduce((n, r) => n + (r.masked?.length || 0), 0)
					}
			  }
			: {}),
		...(run.binMethylation
			? { binMethylation: { ...run.binMethylation, bins: run.binMethylation.bins.filter(b => keep.has(b.chr)) } }
			: {})
	}
}

export function dmrScanToRows(
	payload: TermdbDmrBatchSuccessResponse,
	opts: {
		chromosomes: string[]
		/** what DMRcate ran over, when the rows are a view of a larger run; default chromosomes */
		runChromosomes?: string[]
		minCpgs?: number
		/** |Δβ| below which a DMR is plotted but not counted; see DiffMethRequest.scan.minDeltaBeta */
		minDeltaBeta?: number
		yAxis?: string
	}
): { rows: DiffMethEntry[]; scan: DmrScanSummary } {
	const minCpgs = Math.max(1, Math.floor(opts.minCpgs ?? DEFAULT_MIN_CPGS))
	// from the request: anything but one of DMRcate's region statistics gets the default
	const yAxis: DmrScanYAxis = DMR_SCAN_Y_AXES.includes(opts.yAxis as DmrScanYAxis)
		? (opts.yAxis as DmrScanYAxis)
		: 'min_smoothed_fdr'
	const called: Dmr[] = payload.regions.flatMap(r => r.dmrs || [])
	const kept = called.filter(d => d.no_cpgs >= minCpgs)
	/* What is counted: the kept DMRs whose beta moved at least the volcano's Min Δβ. The rest stay on
	the volcano, under its own threshold, but are not counted or drawn on the track: where the groups differ in read depth, DMRcate's pseudocount log-ratio
	calls DMRs with no beta change (DISCOVER CSF: 87% of calls moved beta by less than 0.1). */
	const minDeltaBeta = Math.max(0, Number(opts.minDeltaBeta) || 0)
	const shown = kept.filter(d => clearsMinDeltaBeta(d.delta_beta_mean, minDeltaBeta))
	/* A DMR whose chosen statistic the run could not compute (null): it has no evidence to plot, which is not
	the evidence of no change a p of 1 would claim. Counted, as withoutStatistic. And one with no Δβ, which has no
	effect to plot: counted as withoutDeltaBeta, and left out of `shown` by clearsMinDeltaBeta too. */
	const measured = kept.filter(d => d.delta_beta_mean != null)
	const plotted = measured.filter(d => isPlottedDmr(d, yAxis))
	const rows: DiffMethEntry[] = plotted.map(d => {
		/* y is the region statistic the reader picked. The default, the minimum smoothed FDR, is what
		DMRcate calls regions by, but kernel pooling makes it astronomically small (1e-22 to below
		double precision on DISCOVER chr17), so dots crowd the top of the axis; HMFDR, Stouffer and
		Fisher combine the region's raw per-CpG p-values and spread out from 0. */
		const p = d[yAxis]!
		const id = `${d.chr}:${d.start}-${d.stop}`
		const genes = d.genes?.length
			? d.genes.join(', ') + (d.genesTruncated ? ` +${d.genesTruncated - d.genes.length} more` : '')
			: ''
		return {
			promoter_id: id,
			element_id: id,
			element_class: 'dmr',
			gene_name: genes,
			chr: d.chr,
			start: d.start,
			stop: d.stop,
			/* Delta-beta, the effect a reader interprets; DMRcate's own meandiff/maxdiff are logit2 and
			stay on the DMR. Both are set: a DMR with no Δβ is not among the rows. */
			delta_beta: d.delta_beta_mean!,
			fold_change: d.delta_beta_max!,
			// one p per DMR: the chosen region statistic
			original_p_value: p,
			adjusted_p_value: p,
			no_cpgs: d.no_cpgs,
			min_smoothed_fdr: d.min_smoothed_fdr
		}
	})

	/* What the scan actually covers, read off the result rather than the request: under
	serverconfig.debugmode a chromosome with no CpG shard is skipped (requireCpgShards), and a panel
	saying "24" while one ran would misdescribe every number under it. */
	const scanned = [...new Set(payload.regions.map(r => r.chr))]

	const widths = shown.map(d => d.stop - d.start).sort((a, b) => a - b)
	const q = (p: number) => widths[Math.floor(p * (widths.length - 1))]
	const hyper = shown.filter(d => d.direction == 'hyper').length

	const scan: DmrScanSummary = {
		/* What the scan actually covers, read off the result rather than the request: under
		serverconfig.debugmode a chromosome with no CpG shard is skipped (requireCpgShards), and the
		panel saying "24" while one ran would misdescribe every number under it. */
		chromosomes: scanned.length ? scanned : opts.chromosomes,
		runChromosomes: opts.runChromosomes || opts.chromosomes,
		...(payload.constants
			? {
					dmrcate: {
						lambda: payload.constants.lambda,
						C: payload.constants.C,
						fdr_cutoff: payload.constants.fdr_cutoff
					}
			  }
			: {}),
		totalProbesAnalyzed: payload.totalProbesAnalyzed,
		called: called.length,
		minCpgs,
		kept: kept.length,
		minDeltaBeta,
		shown: shown.length,
		yAxis,
		...(plotted.length < measured.length ? { withoutStatistic: measured.length - plotted.length } : {}),
		...(measured.length < kept.length ? { withoutDeltaBeta: kept.length - measured.length } : {}),
		hyper,
		hypo: shown.length - hyper,
		...(widths.length ? { width: { median: q(0.5), q1: q(0.25), q3: q(0.75) } } : {}),
		...(payload.globalMethylation ? { globalMethylation: payload.globalMethylation } : {}),
		...(payload.regionMask ? { regionMask: payload.regionMask } : {}),
		...(payload.resources ? { resources: payload.resources } : {}),
		...(payload.binMethylation ? { binMethylation: payload.binMethylation } : {})
	}
	return { rows, scan }
}

/* How much of the measured methylome moved, and by how much. Reported beside the DMR counts
because the two answer different questions: 123,000 DMRs sounds like a transformed genome, and the
fraction of 100 kb bins that actually shifted says whether it is. Quantiles rather than a mean, so
one extreme territory cannot carry the summary. */
export function summarizeProfile(bm: NonNullable<DmrScanSummary['binMethylation']>): DmrScanSummary['profileSummary'] {
	const d = bm.bins.map(b => b.case - b.control).sort((a, b) => a - b)
	if (!d.length) return undefined
	const q = (p: number) => d[Math.min(d.length - 1, Math.floor(p * d.length))]
	const beyond = (t: number) => d.filter(v => Math.abs(v) > t).length / d.length
	return {
		bins: d.length,
		median: q(0.5),
		q1: q(0.25),
		q3: q(0.75),
		/* 0.05 and 0.1 in beta: the smaller is about the size of the global drift on a cohort like
		this one, the larger is the difference a reader would call a real change in a region. */
		fractionBeyond05: beyond(0.05),
		fractionBeyond10: beyond(0.1),
		fractionHyper: d.filter(v => v > 0).length / d.length
	}
}

/** The kept DMRs as the body of a plain text bedj track file, for writeDmrBedjFile(). One file per
 * (scan, CpG floor), since the floor is a display knob applied after the scan. */
export function dmrBedjLines(payload: TermdbDmrBatchSuccessResponse, minCpgs: number, minDeltaBeta = 0): string {
	// bedj.js reads a plain text file only up to the region in view, so it needs each chromosome's
	// lines contiguous and ascending by start; any chr order will do
	const dmrs = (payload.regions || [])
		.flatMap(r => r.dmrs || [])
		.filter(d => d.no_cpgs >= minCpgs && clearsMinDeltaBeta(d.delta_beta_mean, minDeltaBeta))
	dmrs.sort((a, b) => (a.chr == b.chr ? a.start - b.start : a.chr < b.chr ? -1 : 1))
	// 4th column is the bedj item as JSON; category drives both the fill and the block legend
	const lines = dmrs.map(d => {
		const db = d.delta_beta_mean ?? 0
		const label = `Δβ ${db >= 0 ? '+' : ''}${db.toFixed(3)}, ${d.no_cpgs} CpGs${
			d.genes?.length ? ', ' + d.genes.join(' ') : ''
		}`
		// delta_beta and no_cpgs repeat the label as values, for a reader of the items (the methylation track's DMR row)
		const item = { name: label, category: d.direction, delta_beta: Number(db.toFixed(3)), no_cpgs: d.no_cpgs }
		return `${d.chr}\t${d.start}\t${d.stop}\t${JSON.stringify(item)}`
	})
	return lines.length ? lines.join('\n') + '\n' : ''
}
