/* Bin a DMR scan by genomic position, per chromosome and direction.

A genome scan returns >100,000 DMRs; no table of them answers "where". Counting hyper and hypo
calls per fixed-width bin does, and the client draws log2(hyper/hypo) per bin as the genome map.
Pure and shared: the server bins because the browser never receives every DMR (the volcano caps
its interactive rows), and the client tests bin against the same code the figure was drawn from. */

/** One bin width for the WHOLE figure, taken from the longest chromosome, so a bar means the same
 * number of megabases on every track. Binning each chromosome to a fixed COUNT instead would make
 * chr21's bars six times finer than chr1's and the tracks silently incomparable. Rounded to a whole
 * Mb so the axis reads in round numbers on any genome. */
export function domainBinBp(maxLen: number) {
	return Math.max(1e6, Math.round(maxLen / 50 / 1e6) * 1e6)
}

/** Per-chromosome [hyper, hypo] counts per bin, keyed by chromosome. */
export function domainBins(
	rows: { chr: string; start: number; direction: string }[],
	chrs: string[],
	lens: Record<string, number>,
	binBp: number
) {
	const counts: Record<string, [number, number][]> = {}
	for (const c of chrs) counts[c] = Array.from({ length: Math.ceil(lens[c] / binBp) }, () => [0, 0] as [number, number])
	for (const r of rows) {
		const b = counts[r.chr]
		if (!b) continue
		/* A DMR starting at or past the declared chromosome length lands in the last bin rather
		than off the end: assemblies and annotation sources do not always agree on the final base,
		and dropping such a DMR would silently lose it from a figure that claims to show all. */
		const i = Math.min(b.length - 1, Math.max(0, Math.floor(r.start / binBp)))
		b[i][r.direction == 'hyper' ? 0 : 1]++
	}
	return counts
}
