/* Link a scan's DMRs to the genes they could regulate, and read each link against expression.

A DMR's `genes` (dmrGenes.ts) are the genes whose SPAN it overlaps, which misses the case that
matters most -- a promoter DMR just upstream of a TSS -- and cannot say where in the gene it sits,
because gene2coord carries no strand. This module places DMRs against strand-aware TSSs instead:

- promoter: overlaps TSS ± PROMOTER_PAD, upstream or down
- body: overlaps the gene's span outside that window (the 3' flank included; gene-body methylation
  runs to the TES)

The two contexts predict opposite relationships to transcription, which is the whole point of
separating them: promoter methylation silences (Δβ and log2FC of opposite sign), gene-body
methylation tracks transcription (same sign; Jones 2012 Nat Rev Genet 13:484, Yang 2014 Cancer Cell
26:577). Pure, so the rules are checked without a genome or a dataset. */

export const PROMOTER_PAD = 2000

export type GeneModel = { name: string; chr: string; start: number; stop: number; strand: string }
export type TssIndex = Map<string, { tss: number[]; genes: GeneModel[]; maxSpan: number }>

type Dmr = { chr: string; start: number; stop: number; no_cpgs: number; meandiff: number; min_smoothed_fdr: number }

export type GeneLink = {
	gene: string
	context: 'promoter' | 'body'
	/** the DMR with the largest |Δβ| in this gene and context, the one the relationship is read from */
	dmr: { chr: string; start: number; stop: number; deltaBeta: number; cpgs: number; fdr: number }
	/** all kept DMRs in this gene and context */
	nDmrs: number
}

/** Start-sorted genes per chromosome, one model per gene (its default isoform). */
export function buildTssIndex(models: GeneModel[]): TssIndex {
	const byChr = new Map<string, GeneModel[]>()
	for (const m of models) {
		if (!m?.chr || !Number.isFinite(m.start) || !Number.isFinite(m.stop)) continue
		byChr.set(m.chr, [...(byChr.get(m.chr) || []), m])
	}
	const idx: TssIndex = new Map()
	for (const [chr, genes] of byChr) {
		genes.sort((a, b) => a.start - b.start)
		idx.set(chr, {
			tss: genes.map(g => (g.strand == '-' ? g.stop : g.start)),
			genes,
			maxSpan: genes.reduce((m, g) => Math.max(m, g.stop - g.start), 0) + PROMOTER_PAD
		})
	}
	return idx
}

/** Genes a DMR touches, each with the context it touches it in. A gene is reported once: promoter
 * wins over body when a DMR spans both, since that is the mechanism with the larger effect. */
export function genesForDmr(idx: TssIndex, d: { chr: string; start: number; stop: number }) {
	const c = idx.get(d.chr)
	if (!c) return []
	// genes are start-sorted; anything touching the DMR starts before stop + pad and after start - maxSpan
	let hi = c.genes.length
	let lo = 0
	while (lo < hi) {
		const mid = (lo + hi) >> 1
		if (c.genes[mid].start < d.stop + PROMOTER_PAD) lo = mid + 1
		else hi = mid
	}
	// a gene can carry several default models (RefSeq and Ensembl); any promoter hit wins for the gene
	const out = new Map<string, 'promoter' | 'body'>()
	for (let i = lo - 1; i >= 0 && c.genes[i].start >= d.start - c.maxSpan; i--) {
		const g = c.genes[i]
		const tss = c.tss[i]
		if (d.start < tss + PROMOTER_PAD && tss - PROMOTER_PAD < d.stop) out.set(g.name, 'promoter')
		else if (d.start < g.stop && g.start < d.stop && !out.has(g.name)) out.set(g.name, 'body')
	}
	return [...out].reverse().map(([gene, context]) => ({ gene, context }))
}

/** One link per gene and context, from every DMR meeting the CpG floor. */
export function linkDmrsToGenes(dmrs: Dmr[], idx: TssIndex, minCpgs: number): GeneLink[] {
	const links = new Map<string, GeneLink>()
	for (const d of dmrs) {
		if (d.no_cpgs < minCpgs) continue
		for (const { gene, context } of genesForDmr(idx, d)) {
			const key = `${gene}\t${context}`
			const dmr = {
				chr: d.chr,
				start: d.start,
				stop: d.stop,
				deltaBeta: d.meandiff,
				cpgs: d.no_cpgs,
				fdr: d.min_smoothed_fdr
			}
			const l = links.get(key)
			if (!l) links.set(key, { gene, context, dmr, nDmrs: 1 })
			else {
				l.nDmrs++
				if (Math.abs(d.meandiff) > Math.abs(l.dmr.deltaBeta)) l.dmr = dmr
			}
		}
	}
	return [...links.values()]
}

export type Relationship = 'concordant' | 'discordant' | 'no expression change' | 'not tested'

/** How a gene's expression change reads against its DMR, given where the DMR sits. */
export function classifyLink(
	context: 'promoter' | 'body',
	deltaBeta: number,
	expr: { fc: number; p: number } | undefined,
	alpha = 0.05
): Relationship {
	if (!expr || !Number.isFinite(expr.fc) || !Number.isFinite(expr.p)) return 'not tested'
	if (expr.p >= alpha || expr.fc == 0) return 'no expression change'
	const same = Math.sign(deltaBeta) == Math.sign(expr.fc)
	// promoter methylation represses; gene-body methylation accompanies transcription
	return (context == 'promoter') != same ? 'concordant' : 'discordant'
}
