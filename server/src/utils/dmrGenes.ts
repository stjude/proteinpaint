/* Name the DMRs.

A scan returns coordinates. The element-level volcano returns "XIST" -- and that word is the whole
difference between a row someone can act on and a row someone has to go look up. The volcano gets
it by testing pre-annotated elements, which is exactly what costs it coverage and spatial extent:
it reported the XIST event as the 285bp cCRE it happened to test, where the scan finds the real
1,760bp / 29-CpG block. Annotating scan output closes that gap without giving the extent back up.

Genes come from the genome's gene2coord table, loaded once per request and indexed in memory: one
sqlite round trip per DMR would be ~123,000 of them on a genome scan. */

/** Genes overlapping a DMR, beyond this many, are summarised rather than listed. A DMR crossing a
 * gene cluster otherwise fills the column with names nobody reads. */
export const MAX_GENES_PER_DMR = 6

type GeneIndex = Map<string, { start: number[]; stop: number[]; name: string[]; maxSpan: number }>

/** Build a per-chromosome, start-sorted index of gene spans. Returns null when the genome has no
 * gene2coord table, which is not an error -- the column is simply omitted. */
export function buildGeneIndex(genome: any): GeneIndex | null {
	const db = genome?.genedb?.db
	if (!db) return null
	let rows: any[]
	try {
		rows = db.prepare('select name, chr, start, stop from gene2coord').all()
	} catch {
		return null // table absent on this genome build
	}
	const byChr = new Map<string, { name: string; start: number; stop: number }[]>()
	for (const r of rows) {
		if (!r?.chr || !Number.isFinite(r.start) || !Number.isFinite(r.stop)) continue
		const lst = byChr.get(r.chr) || []
		lst.push({ name: r.name, start: r.start, stop: r.stop })
		byChr.set(r.chr, lst)
	}
	const idx: GeneIndex = new Map()
	for (const [chr, lst] of byChr) {
		lst.sort((a, b) => a.start - b.start)
		idx.set(chr, {
			start: lst.map(g => g.start),
			stop: lst.map(g => g.stop),
			name: lst.map(g => g.name),
			/* The longest gene on this chromosome. A gene overlapping a DMR can start far before it
			(DMD spans 2.2Mb), so the backward walk below has to reach at least that far -- bounding it
			by the actual maximum keeps the walk short on chromosomes with no such gene. */
			maxSpan: lst.reduce((m, g) => Math.max(m, g.stop - g.start), 0)
		})
	}
	return idx
}

/** Names of genes whose span overlaps [start, stop). Sorted by start, so the order is genomic. */
export function genesAt(idx: GeneIndex, chr: string, start: number, stop: number): string[] {
	const c = idx.get(chr)
	if (!c) return []
	// first gene starting at or after stop; everything overlapping begins before that
	let lo = 0
	let hi = c.start.length
	while (lo < hi) {
		const mid = (lo + hi) >> 1
		if (c.start[mid] < stop) lo = mid + 1
		else hi = mid
	}
	const out: string[] = []
	const floor = start - c.maxSpan
	for (let i = lo - 1; i >= 0 && c.start[i] >= floor; i--) {
		if (c.stop[i] > start) out.push(c.name[i])
	}
	return out.reverse()
}
