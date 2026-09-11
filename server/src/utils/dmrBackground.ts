import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { loadMaskIntervals, type MaskInterval } from '#src/utils/regionMask.ts'

/* Matched intergenic background for a DMR scan.

A scan tests every region's delta-beta against ZERO, which asks "did this region change?". On a
cohort whose whole genome is drifting -- MMRF NSD2-high runs a +0.06 global shift -- the answer is
yes almost everywhere, and the question worth asking is instead:

    did this region change MORE than a region like it would have drifted anyway?

So we sample intergenic windows that are structurally like the called DMRs, put them through the
same fit, and score each DMR against the background in its own stratum. Method follows the
element-level correction documented in utils/dnaMeth/ELEMENT_CLASSES.md; what makes it cheap here
is that the scan's fit already holds both group means for every probe, so a background window's
delta is a lookup rather than a second analysis.

Constraints carried over from that spec, because they are easy to get wrong:
  - background must be GENUINELY intergenic: cCREs of every class, gene bodies with TSS padding,
    and the ENCODE blacklist are all excluded. Enlarging the pool by relaxing this defeats it.
  - never use other regulatory elements as the null -- they are systematically unlike intergenic
    space, and that comparison answers a different question.
  - do not ALSO normalise the matrix to remove the global shift. The stratified comparison IS the
    correction; a second one would erase real biology along with the drift. */

/** Background windows sampled per chromosome. Enough to populate the strata below without making
 * the rust call meaningfully slower -- a window's delta is a binary search, not an analysis. */
export const BG_WINDOWS_PER_CHR = 2000

/** Padding either side of a transcript, so a window abutting a promoter is not called intergenic. */
const TSS_PAD = 2000

/** Deterministic PRNG. Math.random would make an identical request return different numbers and,
 * worse, make the route's cache serve one arbitrary draw forever. Seeded from the chromosome so
 * each one samples independently but reproducibly. */
function makeRng(seed: number) {
	let s = seed >>> 0 || 1
	return () => {
		s ^= s << 13
		s >>>= 0
		s ^= s >> 17
		s ^= s << 5
		s >>>= 0
		return s / 4294967296
	}
}

function merge(ivs: MaskInterval[]): MaskInterval[] {
	ivs.sort((a, b) => a[0] - b[0])
	const out: MaskInterval[] = []
	for (const iv of ivs) {
		const last = out[out.length - 1]
		if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1])
		else out.push([iv[0], iv[1]])
	}
	return out
}

/** Everything a background window must avoid, merged: regulatory elements, transcribed regions
 * with their promoters, and artifact regions. Returns null when the genome cannot supply the
 * annotation, which the caller must treat as "cannot correct" rather than "nothing to avoid". */
export async function buildExclusion(
	genome: any,
	chr: string,
	chrLen: number,
	geneIdx: Map<string, { start: number[]; stop: number[] }> | null
): Promise<MaskInterval[] | null> {
	const ccreTk = (genome?.tracks || []).find((t: any) => t.name == 'ENCODE cCREs')
	if (!ccreTk?.file) return null // without the registry we cannot say what is intergenic
	/* Genome TRACK paths stay relative to tpmasterdir -- they are sent to the client, which asks the
	server to read them -- where blacklists are absolutized at genome init. Joining here rather than
	assuming one convention holds for both. */
	const abs = (f: string) => (path.isAbsolute(f) ? f : path.join(serverconfig.tpmasterdir, f))
	const files = [abs(ccreTk.file), ...(genome.blacklists || []).map((b: any) => abs(b.file))]
	const ivs: MaskInterval[] = [...(await loadMaskIntervals(files, chr, chrLen))]
	const g = geneIdx?.get(chr)
	if (g) for (let i = 0; i < g.start.length; i++) ivs.push([g.start[i] - TSS_PAD, g.stop[i] + TSS_PAD])
	return merge(ivs)
}

/** Sample width-matched windows from the space the exclusion leaves. Widths are drawn from the
 * DMRs actually called on this chromosome, so the background is matched on size as well as on
 * being intergenic -- a wide DMR must not be compared to a background of narrow ones, since width
 * and drift are related. */
export function sampleBackground(
	chr: string,
	chrLen: number,
	exclusion: MaskInterval[],
	dmrWidths: number[],
	n: number,
	seed: number
): { chr: string; start: number; stop: number }[] {
	if (!dmrWidths.length) return []
	// complement of the exclusion: the intervals a window may sit inside
	const allowed: MaskInterval[] = []
	let cursor = 0
	for (const [s, e] of exclusion) {
		if (s > cursor) allowed.push([cursor, Math.min(s, chrLen)])
		cursor = Math.max(cursor, e)
		if (cursor >= chrLen) break
	}
	if (cursor < chrLen) allowed.push([cursor, chrLen])
	const usable = allowed.filter(([s, e]) => e - s > 0)
	if (!usable.length) return []
	// cumulative length, so a window lands uniformly over intergenic BASES rather than over
	// intervals -- sampling intervals evenly would over-represent the many tiny gaps
	const cum: number[] = []
	let tot = 0
	for (const [s, e] of usable) {
		tot += e - s
		cum.push(tot)
	}
	const rnd = makeRng(seed)
	const out: { chr: string; start: number; stop: number }[] = []
	let guard = 0
	while (out.length < n && guard < n * 20) {
		guard++
		const w = dmrWidths[Math.floor(rnd() * dmrWidths.length)]
		const t = rnd() * tot
		let lo = 0
		let hi = cum.length - 1
		while (lo < hi) {
			const mid = (lo + hi) >> 1
			if (cum[mid] < t) lo = mid + 1
			else hi = mid
		}
		const [s, e] = usable[lo]
		if (e - s < w) continue // this gap cannot hold a window of that width; draw again
		const off = Math.floor(rnd() * (e - s - w + 1))
		out.push({ chr, start: s + off, stop: s + off + w })
	}
	return out
}

type Scored = { excess: number; p: number; stratum: string }

/** Stratum key: CpG density and width, the two structural properties available without reference
 * tracks. The spec also matches on solo-WCGW, replication timing and lamina association, which
 * need normal-B-cell reference data this deployment does not carry -- so the correction is
 * reported as density+width matched and must be described that way. */
function stratumOf(nProbes: number, width: number): string {
	const dens = width > 0 ? (nProbes / width) * 1000 : 0
	const d = dens <= 0 ? 0 : Math.min(5, Math.floor(Math.log2(dens + 1)))
	const w = Math.min(5, Math.floor(Math.log10(Math.max(width, 1))))
	return `${d}:${w}`
}

/** Score each DMR against background in its own stratum.
 *
 * excess = observed delta - mean(background delta in stratum)
 * p      = fraction of that background at least as extreme, with a +1 pseudocount so a DMR can
 *          never be reported at p=0 -- the resolution floor is 1/(n+1), not zero. */
export function scoreAgainstBackground(
	dmrs: { no_cpgs: number; start: number; stop: number; meandiff: number }[],
	background: { n_probes: number; start: number; stop: number; delta: number | null }[]
): { scored: (Scored | null)[]; strataUsed: number; unscored: number } {
	const byStratum = new Map<string, number[]>()
	for (const b of background) {
		if (b.delta == null || !Number.isFinite(b.delta) || !b.n_probes) continue
		const k = stratumOf(b.n_probes, b.stop - b.start)
		const lst = byStratum.get(k) || []
		lst.push(b.delta)
		byStratum.set(k, lst)
	}
	/* Below this a stratum's mean and tail are not estimable and scoring against it would invent
	precision. Such DMRs come back unscored rather than scored badly. */
	const MIN_BG = 20
	let unscored = 0
	const scored = dmrs.map(d => {
		const k = stratumOf(d.no_cpgs, d.stop - d.start)
		const bg = byStratum.get(k)
		if (!bg || bg.length < MIN_BG) {
			unscored++
			return null
		}
		const mean = bg.reduce((a, b) => a + b, 0) / bg.length
		const obs = d.meandiff
		// two-sided: how often does background drift at least this far in the same direction?
		const atLeast = bg.filter(v => (obs >= 0 ? v >= obs : v <= obs)).length
		return { excess: obs - mean, p: (atLeast + 1) / (bg.length + 1), stratum: k }
	})
	return { scored, strataUsed: [...byStratum.values()].filter(v => v.length >= MIN_BG).length, unscored }
}
