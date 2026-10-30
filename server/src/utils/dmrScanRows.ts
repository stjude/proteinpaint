import type { DiffMethEntry, DmrScanSummary, DmrScanYAxis, TermdbDmrBatchSuccessResponse } from '#types'
import { DEFAULT_MIN_CPGS, DMR_SCAN_Y_AXES } from '#types'

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
		backgroundCorrection?: boolean
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
	the volcano, under its own threshold, but are not counted, drawn on the Manhattan or the track,
	nor put in the gene set: where the groups differ in read depth, DMRcate's pseudocount log-ratio
	calls DMRs with no beta change (DISCOVER CSF: 87% of calls moved beta by less than 0.1). */
	const minDeltaBeta = Math.max(0, Number(opts.minDeltaBeta) || 0)
	const shown = kept.filter(d => Math.abs(d.delta_beta_mean ?? 0) >= minDeltaBeta)
	/* With the correction on, the plotted p IS the background p, so a DMR whose stratum held too
	little background to score has no y coordinate and is left out of the rows. Counted as
	unscored rather than silently dropped: those are the widest and most CpG-dense regions,
	which intergenic space cannot match, so "not testable this way" must stay distinguishable
	from "not significant". */
	const plotted = opts.backgroundCorrection ? kept.filter(d => d.bgP != null) : kept

	const rows: DiffMethEntry[] = plotted.map(d => {
		/* y is the region statistic the reader picked. The default, the minimum smoothed FDR, is what
		DMRcate calls regions by, but kernel pooling makes it astronomically small (1e-22 to below
		double precision on DISCOVER chr17), so dots crowd the top of the axis; HMFDR, Stouffer and
		Fisher combine the region's raw per-CpG p-values and spread out from 0. A statistic the run
		could not compute (null) plots as 1. */
		const p = opts.backgroundCorrection ? d.bgP! : d[yAxis] ?? 1
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
			stay on the DMR. A region with no covered cell in one group has none and plots at 0. */
			delta_beta: d.delta_beta_mean ?? 0,
			fold_change: d.delta_beta_max ?? 0,
			// one p per DMR: DMRcate's HMFDR, or the empirical p against matched background
			original_p_value: p,
			adjusted_p_value: p,
			no_cpgs: d.no_cpgs,
			min_smoothed_fdr: d.min_smoothed_fdr,
			...(d.excess != null ? { excess: d.excess } : {})
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
		totalProbesAnalyzed: payload.totalProbesAnalyzed,
		called: called.length,
		minCpgs,
		kept: kept.length,
		minDeltaBeta,
		shown: shown.length,
		yAxis,
		hyper,
		hypo: shown.length - hyper,
		...(widths.length ? { width: { median: q(0.5), q1: q(0.25), q3: q(0.75) } } : {}),
		...(payload.globalMethylation ? { globalMethylation: payload.globalMethylation } : {}),
		...(payload.regionMask ? { regionMask: payload.regionMask } : {}),
		...(payload.resources ? { resources: payload.resources } : {}),
		...(payload.binMethylation ? { binMethylation: payload.binMethylation } : {})
	}
	if (payload.backgroundCorrection) {
		const scored = shown.filter(d => d.bgP != null)
		scan.backgroundCorrection = {
			windows: payload.backgroundCorrection.windows,
			matchedOn: payload.backgroundCorrection.matchedOn,
			scored: scored.length,
			unscored: shown.length - scored.length,
			significant: scored.filter(d => d.bgP! < 0.05).length
		}
	}
	/* Gene-body loss set: hypomethylated, in a gene body (span with 2kb trimmed off both ends). A
	region clipping only a promoter relates to transcription the other way round, so inGeneBody
	rather than gene overlap is the gate.

	The background p is one more filter when there is one, not a precondition for asking the
	question: a DMR's own smoothed FDR is evidence that the region moved, and whether the genes it
	sits in are expressed lower is answerable either way. The corrected set is the stricter reading
	-- it drops regions that moved no more than their stratum drifts -- and on a cohort with a
	genome-wide shift the two sets differ a lot, which is a result to compare rather than a reason
	to offer only one. */
	const genes = new Set<string>()
	let regions = 0
	for (const d of shown) {
		if (d.direction != 'hypo' || !d.inGeneBody) continue
		if (payload.backgroundCorrection && !(d.bgP != null && d.bgP < 0.05)) continue
		regions++
		/* bodyGenes, not genes: genes also lists promoter-only neighbours of an in-body region and is
		capped for display, so it admitted the wrong mechanism and dropped body genes past the cap. */
		for (const g of d.bodyGenes || []) genes.add(g)
	}
	// omitted rather than reported as "0 -> 0": nothing to run the expression test on
	if (regions) scan.geneBodyLoss = { regions, genes: [...genes] }
	return { rows, scan }
}

/** Ceiling on the coarsening factor, so a hostile or mistyped bin width cannot ask for one dot
 * per genome. 100 is 10 Mb at the native 100 kb, already coarser than anything readable. */
const MAX_PROFILE_COARSEN = 100

/* Coarsen the profile for display: several base bins averaged into one, weighted by the probes
each rests on, so a bin resting on 3 CpGs does not count as much as one resting on 3,000.

Display only. 100 kb is the width the field plots this metric at (Zhou 2018; see
METHYLATION_BIN_BP) and the summary rows stay on it; this exists because 29,000 dots over 1,000 px of plot overlap however
small the dot is, so the shape of the shift is hidden inside a band. Applied at render time, after
the cache, so switching widths redraws a scan rather than refitting one. */
export function coarsenProfile(
	bm: NonNullable<DmrScanSummary['binMethylation']>,
	binBp: number | undefined
): NonNullable<DmrScanSummary['binMethylation']> {
	const factor = Math.round((Number(binBp) || 0) / bm.binBp)
	// the native width, anything narrower, or nonsense: leave the bins as they are
	if (!Number.isFinite(factor) || factor < 2) return bm
	const wide = bm.binBp * Math.min(factor, MAX_PROFILE_COARSEN)
	const acc = new Map<string, { chr: string; start: number; probes: number; control: number; case: number }>()
	for (const b of bm.bins) {
		const start = Math.floor(b.start / wide) * wide
		const id = `${b.chr}:${start}`
		let a = acc.get(id)
		if (!a) acc.set(id, (a = { chr: b.chr, start, probes: 0, control: 0, case: 0 }))
		a.probes += b.n_probes
		a.control += b.control * b.n_probes
		a.case += b.case * b.n_probes
	}
	return {
		binBp: wide,
		bins: [...acc.values()]
			// a wide bin with no probes under it is not a measurement; the base bins never are
			.filter(a => a.probes > 0)
			.map(a => ({
				chr: a.chr,
				start: a.start,
				n_probes: a.probes,
				control: a.control / a.probes,
				case: a.case / a.probes
			}))
	}
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
		.filter(d => d.no_cpgs >= minCpgs && Math.abs(d.delta_beta_mean ?? 0) >= minDeltaBeta)
	dmrs.sort((a, b) => (a.chr == b.chr ? a.start - b.start : a.chr < b.chr ? -1 : 1))
	// 4th column is the bedj item as JSON; category drives both the fill and the block legend
	const lines = dmrs.map(d => {
		const db = d.delta_beta_mean ?? 0
		const label = `Δβ ${db >= 0 ? '+' : ''}${db.toFixed(3)}, ${d.no_cpgs} CpGs${
			d.genes?.length ? ', ' + d.genes.join(' ') : ''
		}`
		return `${d.chr}\t${d.start}\t${d.stop}\t${JSON.stringify({ name: label, category: d.direction })}`
	})
	return lines.length ? lines.join('\n') + '\n' : ''
}
