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
import { makeRng, median, normalTwoSidedP } from './dmrStats.ts'
import { readFastaRegion } from '#src/fasta.ts'
import { mayLog } from '#src/helpers.ts'

/** Raised from 2000 when solo-WCGW joined the strata: a third matching variable splits each density x width
 * stratum in three, and a stratum needs MIN_BG windows to be scored at all. Cheap, as before. */
export const BG_WINDOWS_PER_CHR = 6000

/** Padding either side of a transcript, so a window abutting a promoter is not called intergenic. */
const TSS_PAD = 2000

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
	// without gene spans a window can land in a gene body, which is not intergenic
	if (!geneIdx) return null
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

/* Solo-WCGW CpGs: a CpG with no other CpG within SOLO_FLANK bp on either side, flanked by A or T on both
sides (W-CG-W). It is the sequence context that loses methylation most readily in late-replicating,
partially methylated domains, and that loss tracks a cell's division history (Zhou et al. 2018 Nat Genet,
doi 10.1038/s41588-018-0073-4; Endicott et al. 2022 Nat Commun). Global drift between two groups runs
largely along this axis, so a region's share of solo-WCGW CpGs says how much drift to expect of it, and it
is computed from the reference sequence alone -- no replication-timing or lamina tracks needed. */
export const SOLO_FLANK = 35
/** Sequence read per step when sweeping a chromosome. The text of one read is held several times over while
 * it is parsed (fasta lines, joined, upper-cased): at 10 Mb that peaked near 350 MB on hg38 chr1, at 1 Mb it
 * is a tenth of that, for a sweep of chr1 in about 2 s either way. */
const SWEEP_CHUNK = 1_000_000

/** The CpGs whose C lies in [coreStart, coreStop) (0-based genomic), with a solo-WCGW flag each. `seq` is the
 * sequence from 0-based position seqStart and must extend SOLO_FLANK + 1 bases past the core on each side
 * where the chromosome allows, so neighbours and flanks across the core's edges are seen. */
export function scanCpgs(seq: string, seqStart: number, coreStart: number, coreStop: number) {
	const s = seq.toUpperCase() // soft-masked repeats are lower case
	const at: number[] = [] // indices into s of each C of a CpG
	for (let i = s.indexOf('CG'); i != -1; i = s.indexOf('CG', i + 1)) at.push(i)
	const pos: number[] = []
	const solo: boolean[] = []
	const isW = (c: string | undefined) => c == 'A' || c == 'T'
	for (let k = 0; k < at.length; k++) {
		const g = seqStart + at[k]
		if (g < coreStart || g >= coreStop) continue
		const i = at[k]
		const alone = (k == 0 || i - at[k - 1] > SOLO_FLANK) && (k == at.length - 1 || at[k + 1] - i > SOLO_FLANK)
		pos.push(g)
		solo.push(alone && isW(s[i - 1]) && isW(s[i + 2]))
	}
	return { pos, solo }
}

/** Every CpG of a chromosome with its solo-WCGW flag, reading the sequence `chunk` bases at a time with
 * SOLO_FLANK + 1 bases of padding either side, so no CpG is missed or counted twice at a chunk edge. */
export async function sweepCpgs(genomefile: string, chr: string, chrLen: number, chunk = SWEEP_CHUNK) {
	// typed, grown by doubling: hg38 chr1 has 2.4 million CpGs, ~12 MB here against ~57 MB as plain arrays
	let pos = new Int32Array(1 << 16)
	let solo = new Uint8Array(1 << 16)
	let n = 0
	const pad = SOLO_FLANK + 1
	for (let core = 0; core < chrLen; core += chunk) {
		const coreStop = Math.min(chrLen, core + chunk)
		const from = Math.max(0, core - pad)
		const to = Math.min(chrLen, coreStop + pad)
		// readFastaRegion is 1-based inclusive and returns fasta text: drop the header line and the line breaks
		const txt = await readFastaRegion(genomefile, chr, from + 1, to)
		const c = scanCpgs(txt.slice(txt.indexOf('\n') + 1).replace(/\n/g, ''), from, core, coreStop)
		if (n + c.pos.length > pos.length) {
			const size = Math.max(pos.length * 2, n + c.pos.length)
			const p2 = new Int32Array(size)
			p2.set(pos.subarray(0, n))
			pos = p2
			const s2 = new Uint8Array(size)
			s2.set(solo.subarray(0, n))
			solo = s2
		}
		for (let i = 0; i < c.pos.length; i++, n++) {
			pos[n] = c.pos[i]
			solo[n] = c.solo[i] ? 1 : 0
		}
	}
	return { pos: pos.subarray(0, n), solo: solo.subarray(0, n) }
}

/** Each region's share of its CpGs that are solo-WCGW, from the genome sequence: null for a region with no
 * CpG, and all null when the genome has no sequence file or this chromosome's sequence cannot be read (a
 * chromosome missing from the fasta, a length that differs from chrlookup), so its strata fall back to density
 * and width rather than failing the analysis. Never rejects: callers start it before the background run and
 * await it after.
 *
 * Regions are in the methylation matrix's coordinates, as rust reads them: the 1-based position of each CpG's
 * C, start and stop inclusive (a DMR's start IS its first CpG).
 *
 * Sweeps the whole chromosome rather than reading each region: on hg38's bgzipped fasta, reading 14,000
 * DMR-sized spans of chr1 took 2.2 s against 1.6 s for the sweep, as every read decompresses a whole block. */
export async function soloWcgwFractions(
	genomefile: string | undefined,
	chr: string,
	chrLen: number | undefined,
	regions: { start: number; stop: number }[],
	/** sequence per read; only tests change it, to put chunk edges where they can be checked */
	chunk = SWEEP_CHUNK
): Promise<(number | null)[]> {
	const none = () => regions.map(() => null)
	if (!genomefile || genomefile == 'NA' || !chrLen || !regions.length) return none()
	let swept: Awaited<ReturnType<typeof sweepCpgs>>
	try {
		swept = await sweepCpgs(genomefile, chr, chrLen, chunk)
	} catch (e: any) {
		mayLog(`solo-WCGW shares unavailable for ${chr}, matching on density and width:`, e?.message || e)
		return none()
	}
	const { pos, solo } = swept
	const soloCum = new Int32Array(pos.length + 1) // soloCum[i] = solo-WCGW CpGs among pos[0..i)
	for (let i = 0; i < solo.length; i++) soloCum[i + 1] = soloCum[i] + solo[i]
	// first index of pos >= x
	const lowerBound = (x: number) => {
		let lo = 0
		let hi = pos.length
		while (lo < hi) {
			const mid = (lo + hi) >> 1
			if (pos[mid] < x) lo = mid + 1
			else hi = mid
		}
		return lo
	}
	return regions.map(r => {
		// pos is 0-based: the CpGs with pos + 1 in [start, stop]
		const a = lowerBound(r.start - 1)
		const b = lowerBound(r.stop)
		return b > a ? (soloCum[b] - soloCum[a]) / (b - a) : null
	})
}

/** soloWcgwFractions for each chromosome's regions, one chromosome at a time (a sweep holds its chromosome's
 * CpGs). Shared by the scan's and the gene-body correction, so the two stay the same correction. */
export async function soloWcgwShares(
	genome: any,
	parts: { chr: string; regions: { start: number; stop: number }[] }[]
): Promise<(number | null)[][]> {
	const out: (number | null)[][] = []
	for (const { chr, regions } of parts)
		out.push(await soloWcgwFractions(genome.genomefile, chr, genome.chrlookup?.[chr.toUpperCase()]?.len, regions))
	return out
}

/** Stratum key: CpG density, width and, when the sequence gave it, the tertile of solo-WCGW share ('' when
 * not). Density and width are the structural properties; the solo-WCGW tertile matches on the sequence
 * context that drifts most. The spec's replication timing and lamina association still need reference
 * tracks this deployment does not carry, so the correction must be described as matched on what
 * `matchedOn` lists and no more. */
function stratumOf(nProbes: number, width: number, soloTertile = ''): string {
	const dens = width > 0 ? (nProbes / width) * 1000 : 0
	const d = dens <= 0 ? 0 : Math.min(5, Math.floor(Math.log2(dens + 1)))
	const w = Math.min(5, Math.floor(Math.log10(Math.max(width, 1))))
	return `${d}:${w}:${soloTertile}`
}

/** Score each DMR against background in its own stratum, by an empirical null in the sense of Efron (JASA
 * 2004): the stratum's background fixes the null's centre and spread, and the DMR is tested against that
 * rather than against zero.
 *
 * excess = observed delta - centre, the centre being the median background delta in the stratum
 * p      = two-sided normal p of excess / scale, the scale being 1.4826 x the background's median absolute
 *          deviation (the normal-consistent robust SD; the SD itself when the MAD is 0), widened when needed so
 *          that 5% of the stratum's own background lies beyond p = 0.05 (tail calibration, below)
 *
 * Why a fitted null and not the fraction of background at least as extreme: that fraction cannot go below
 * 1/(n+1), about 1e-3 for a well-filled stratum, and a genome scan scores 10^5 DMRs, so no DMR could survive
 * a false-discovery adjustment however far it moved. The fitted null gives a continuous p. `nullCheck` counts
 * the background windows that score p < 0.001 against their own stratum: ~0.1% when the normal null fits the
 * tail, more when the background's tail is heavier than the null past the p = 0.05 point the calibration fixes.
 * Not at p < 0.05, which the calibration holds at <= 5% whatever the tail does. It reaches only as deep as the
 * background's size allows -- ~150 windows expected at p < 0.001 on a genome scan -- not to the far-tail p of
 * the DMRs that pass FDR.
 *
 * `solo`, when given, holds each DMR's and each background window's solo-WCGW share (soloWcgwFractions, in
 * the same order). Strata then also split at the tertiles of that share among the background windows that
 * are scored (probes and a delta), so each tertile holds a third of the usable draw and stays scorable. */
export function scoreAgainstBackground(
	// delta-beta, the scale the background windows are measured on; DMRcate's meandiff is logit2
	dmrs: { no_cpgs: number; start: number; stop: number; delta_beta_mean: number | null }[],
	background: { n_probes: number; start: number; stop: number; delta: number | null }[],
	solo?: { dmrs: (number | null)[]; background: (number | null)[] }
): {
	scored: (Scored | null)[]
	strataUsed: number
	unscored: number
	soloMatched: boolean
	nullCheck: { windows: number; belowP001: number }
} {
	const usable = (b: (typeof background)[number]) => b.delta != null && Number.isFinite(b.delta) && !!b.n_probes
	const bgSolo = (solo?.background || [])
		.filter((v, i): v is number => v != null && Number.isFinite(v) && usable(background[i]))
		.sort((a, b) => a - b)
	const soloMatched = bgSolo.length >= 3
	const cuts = soloMatched ? [bgSolo[Math.floor(bgSolo.length / 3)], bgSolo[Math.floor((2 * bgSolo.length) / 3)]] : []
	// a region with no CpG in the sequence has no share; it gets its own label rather than a guessed tertile
	const tertile = (v: number | null | undefined) =>
		!soloMatched ? '' : v == null ? 'none' : v < cuts[0] ? '0' : v < cuts[1] ? '1' : '2'
	const byStratum = new Map<string, number[]>()
	background.forEach((b, i) => {
		if (!usable(b)) return
		const k = stratumOf(b.n_probes, b.stop - b.start, tertile(solo?.background[i]))
		const lst = byStratum.get(k) || []
		lst.push(b.delta!)
		byStratum.set(k, lst)
	})
	/* Below this a stratum's centre and spread are not estimable and scoring against it would invent
	precision. Such DMRs come back unscored rather than scored badly. */
	const MIN_BG = 20
	// each usable stratum's null, fitted once; a stratum with no spread at all cannot scale an excess
	const nulls = new Map<string, { centre: number; scale: number }>()
	const nullCheck = { windows: 0, belowP001: 0 }
	for (const [k, bg] of byStratum) {
		if (bg.length < MIN_BG) continue
		const centre = median(bg)
		const dev = bg.map(v => Math.abs(v - centre)).sort((a, b) => a - b)
		let scale = 1.4826 * median(dev)
		if (!(scale > 0)) scale = Math.sqrt(bg.reduce((a, v) => a + (v - centre) ** 2, 0) / (bg.length - 1))
		/* Tail calibration: never narrower than the spread that puts 5% of this stratum's own background beyond
		p = 0.05. A heavy-tailed background otherwise reads its own ordinary windows as significant, and every
		DMR's p with them; a light-tailed one keeps its robust scale, so this only ever widens the null. It fixes
		the fit at p = 0.05; further into the tail a heavy-tailed null can still be optimistic. */
		// 1.95996, a hair under the 0.975 normal quantile, so the window setting the scale lands just above p = 0.05
		scale = Math.max(scale, dev[Math.ceil(0.95 * dev.length) - 1] / 1.95996)
		if (!(scale > 0)) continue
		nulls.set(k, { centre, scale })
		nullCheck.windows += bg.length
		nullCheck.belowP001 += bg.filter(v => normalTwoSidedP((v - centre) / scale) < 0.001).length
	}
	let unscored = 0
	const scored = dmrs.map((d, i) => {
		const k = stratumOf(d.no_cpgs, d.stop - d.start, tertile(solo?.dmrs[i]))
		const n = nulls.get(k)
		if (!n || d.delta_beta_mean == null) {
			unscored++
			return null
		}
		const excess = d.delta_beta_mean - n.centre
		return { excess, p: normalTwoSidedP(excess / n.scale), stratum: k }
	})
	return { scored, strataUsed: nulls.size, unscored, soloMatched, nullCheck }
}
