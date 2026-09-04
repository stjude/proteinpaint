import { get_lines_bigfile } from '#src/utils.js'

/* Artifact-region masking against the genome's declared blacklist BEDs (Genome.blacklists,
declared in server/genome/hg38.base.ts and path-absolutized at genome init).

Shared by GRIN2, which drops GENES lying in these regions before recurrence testing, and by DMR
analysis, which drops called DMRs. The selector lives here rather than in either route so the two
cannot drift, and so importing it does not drag in a route's whole module graph.

The sources are NOT interchangeable, and each consumer picks the ones whose artifact mechanism
actually applies to it -- see DM_DEFAULT_BLACKLISTS. */

/** Resolve genome-declared blacklist BED files. `selectedNames` chooses which sources to apply:
 * undefined = all declared, [] = none, otherwise the named subset. Unknown names are ignored.
 * Returns absolute BED file paths. */
export function resolveExcludeBeds(g: any, selectedNames?: string[]): string[] {
	const all = g.blacklists as { name: string; file: string }[] | undefined
	if (!all?.length) return []
	const wanted = new Set(selectedNames ?? all.map(b => b.name))
	return all.filter(b => wanted.has(b.name)).map(b => b.file)
}

/* Which sources a methylation caller should mask against, and why the other two are left out.

Segmental duplications and the ENCODE blacklist apply directly: multi-mapping reads pile onto one
copy of a duplicated locus, so the methylated and unmethylated counts are pooled across paralogs
and beta is simply wrong there. On MMRF chr1 that shows up as CpG density -- chr1:143,184,605-
143,276,149 came back as a 91kb "DMR" holding 4,055 CpGs, 44 per kb against a median of 11, and it
sits 100% inside BOTH of these sources.

Common germline CNVs (DGV) is a GRIN2 concern, not ours, and it is the single largest contributor
(429 of 566 chr1 DMRs the full four-source mask drops). It exists to stop germline copy-number
polymorphism masquerading as somatic CNV recurrence. Beta is a RATIO of reads at a locus, so it is
copy-number invariant to first order, and germline CNV frequency does not differ between groups
split on expression. Masking it would remove real data for a confound that is not operating.

Assembly gaps are omitted because they are free either way: 8.6% of chr1, and zero DMRs dropped,
since a gap contains no CpGs by construction. */
export const DM_DEFAULT_BLACKLISTS = ['ENCODE blacklist', 'Segmental duplications']

/** Default fraction of a feature's span that must be masked before it is dropped. Matches the
 * GRIN2 gene mask, so "half of it is artifact" means the same thing in both. */
export const DEFAULT_OVERLAP_FRAC = 0.5

export type MaskInterval = [start: number, stop: number]

/** Read every masked interval on one chromosome from the given BEDs, merged into a sorted,
 * non-overlapping list. One tabix query per file per chromosome: the caller is already working a
 * chromosome at a time, and a whole-chromosome query returns a few thousand rows at most. */
export async function loadMaskIntervals(files: string[], chr: string, chrLen: number): Promise<MaskInterval[]> {
	if (!files.length) return []
	const raw: MaskInterval[] = []
	for (const file of files) {
		await get_lines_bigfile({
			args: [file, `${chr}:1-${chrLen}`],
			callback: (line: string) => {
				const l = line.split('\t')
				const start = Number(l[1])
				const stop = Number(l[2])
				// a malformed row must not silently mask nothing or everything
				if (Number.isFinite(start) && Number.isFinite(stop) && stop > start) raw.push([start, stop])
			}
		})
	}
	raw.sort((a, b) => a[0] - b[0])
	const merged: MaskInterval[] = []
	for (const iv of raw) {
		const last = merged[merged.length - 1]
		if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1])
		else merged.push([iv[0], iv[1]])
	}
	return merged
}

/** Fraction of [start, stop) covered by the merged mask. Walks forward from the last interval
 * starting at or before `start`, so a feature spanning many masked intervals accumulates all of
 * them -- checking only the neighbouring interval undercounts exactly the wide features this
 * exists to catch. */
export function maskedFraction(mask: MaskInterval[], start: number, stop: number): number {
	const span = stop - start
	if (span <= 0 || !mask.length) return 0
	// last interval with iv[0] <= start
	let lo = 0
	let hi = mask.length
	while (lo < hi) {
		const mid = (lo + hi) >> 1
		if (mask[mid][0] <= start) lo = mid + 1
		else hi = mid
	}
	let covered = 0
	for (let i = Math.max(0, lo - 1); i < mask.length; i++) {
		const [s, e] = mask[i]
		if (s >= stop) break
		const overlap = Math.min(e, stop) - Math.max(s, start)
		if (overlap > 0) covered += overlap
	}
	return covered / span
}
