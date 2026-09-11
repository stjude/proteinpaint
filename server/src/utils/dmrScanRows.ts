import type { DiffMethEntry, DmrScanSummary, TermdbDmrBatchSuccessResponse } from '#types'

/* Turn a DMR scan (termdb/dmrBatch) into rows the differential-methylation volcano can render,
plus the whole-scan summary its Statistics panel shows.

The scan is presented as one more element class of the DM volcano rather than as its own panel:
every DMR becomes a dot with delta-beta on x and a p on y, and the existing PNG rendering, p-value
table, hover, highlight, download and region drill-down all apply unchanged. What this module owns
is the mapping and the numbers the panel prints, kept pure so both can be checked against a saved
scan without a genome or a dataset. */

/** Default CpG floor. Two-CpG calls carry the LARGEST effect sizes and split 51.5% / 48.5% hyper /
 * hypo on MMRF chr1 -- a coin flip -- where 10+ CpG calls run 58% hyper. Five keeps 86% of calls
 * and all of the structure. */
export const DEFAULT_MIN_CPGS = 5

type Dmr = TermdbDmrBatchSuccessResponse['regions'][number]['dmrs'][number]

export function dmrScanToRows(
	payload: TermdbDmrBatchSuccessResponse,
	opts: { chromosomes: string[]; minCpgs?: number; backgroundCorrection?: boolean }
): { rows: DiffMethEntry[]; scan: DmrScanSummary } {
	const minCpgs = Math.max(1, Math.floor(opts.minCpgs ?? DEFAULT_MIN_CPGS))
	const called: Dmr[] = payload.regions.flatMap(r => r.dmrs || [])
	const kept = called.filter(d => d.no_cpgs >= minCpgs)
	/* With the correction on, the plotted p IS the background p, so a DMR whose stratum held too
	little background to score has no y coordinate and is left out of the rows. Counted as
	unscored rather than silently dropped: those are the widest and most CpG-dense regions,
	which intergenic space cannot match, so "not testable this way" must stay distinguishable
	from "not significant". */
	const plotted = opts.backgroundCorrection ? kept.filter(d => d.bgP != null) : kept

	const rows: DiffMethEntry[] = plotted.map(d => {
		const p = opts.backgroundCorrection ? d.bgP! : d.min_smoothed_fdr
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
			delta_beta: d.meandiff,
			/* The peak per-CpG delta-beta. Same sign as the mean by construction (a DMR is one
			direction), so colouring and ranking by it agree with the axis. */
			fold_change: d.maxdiff,
			// one p per DMR: DMRcate's smoothed FDR, or the empirical p against matched background
			original_p_value: p,
			adjusted_p_value: p,
			no_cpgs: d.no_cpgs,
			...(d.excess != null ? { excess: d.excess } : {})
		}
	})

	const widths = kept.map(d => d.stop - d.start).sort((a, b) => a - b)
	const q = (p: number) => widths[Math.floor(p * (widths.length - 1))]
	const hyper = kept.filter(d => d.direction == 'hyper').length

	const scan: DmrScanSummary = {
		chromosomes: opts.chromosomes,
		totalProbesAnalyzed: payload.totalProbesAnalyzed,
		called: called.length,
		minCpgs,
		kept: kept.length,
		hyper,
		hypo: kept.length - hyper,
		...(widths.length ? { width: { median: q(0.5), q1: q(0.25), q3: q(0.75) } } : {}),
		...(payload.globalMethylation ? { globalMethylation: payload.globalMethylation } : {}),
		...(payload.regionMask ? { regionMask: payload.regionMask } : {}),
		...(payload.resources ? { resources: payload.resources } : {})
	}
	if (payload.backgroundCorrection) {
		const scored = kept.filter(d => d.bgP != null)
		scan.backgroundCorrection = {
			windows: payload.backgroundCorrection.windows,
			matchedOn: payload.backgroundCorrection.matchedOn,
			scored: scored.length,
			unscored: kept.length - scored.length,
			significant: scored.filter(d => d.bgP! < 0.05).length
		}
		/* Gene-body loss set: hypomethylated, in a gene body (span with 2kb trimmed off both ends),
		beating background. A region clipping only a promoter relates to transcription the other
		way round, so inGeneBody rather than gene overlap is the gate. */
		const genes = new Set<string>()
		let regions = 0
		for (const d of scored) {
			if (d.direction != 'hypo' || !d.inGeneBody || d.bgP! >= 0.05) continue
			regions++
			for (const g of d.genes || []) genes.add(g)
		}
		scan.geneBodyLoss = { regions, genes: [...genes] }
	}
	return { rows, scan }
}
