import tape from 'tape'
import {
	buildExclusion,
	scanCpgs,
	soloWcgwFractions,
	sweepCpgs,
	sampleBackground,
	scoreAgainstBackground,
	BG_WINDOWS_PER_CHR
} from '#src/utils/dmrBackground.ts'
import { readFastaRegion } from '#src/fasta.ts'
import { benjaminiHochberg, normalTwoSidedP } from '#src/utils/dmrStats.ts'

/*
test sections:

sampleBackground: windows avoid excluded space, match the DMR widths, and are deterministic
scoreAgainstBackground: excess and fitted-null p, and the p floor
scoreAgainstBackground: a stratum with too little background yields no score rather than a bad one
soloWcgwFractions: 1-based inclusive regions, chunked sweep, no-throw fallback
scoreAgainstBackground: solo-WCGW tertiles, cut among usable windows
nullCheck: a tail heavier than the null past the calibration point is counted
benjaminiHochberg: step-up q
*/

/** The correction decides which DMRs survive as more than drift, so a window landing inside an
 * excluded region -- a cCRE, a gene body -- would put regulated sequence into the null and shrink
 * the very signal being measured. And the draw must be reproducible: an identical request that
 * resampled would return different answers, and the route caches its result. */

tape('\n', t => {
	t.comment('-***- dmrBackground specs -***-')
	t.end()
})

tape('sampleBackground avoids excluded space and matches widths', t => {
	// allowed: [0,1000) and [5000,10000); everything else excluded
	const excl: [number, number][] = [
		[1000, 5000],
		[10000, 20000]
	]
	const w = sampleBackground('chr1', 20000, excl, [100, 200], 200, 7)
	t.ok(w.length > 50, `sampled ${w.length} windows`)
	const bad = w.filter(x => !((x.start >= 0 && x.stop <= 1000) || (x.start >= 5000 && x.stop <= 10000)))
	t.equal(bad.length, 0, 'every window lies wholly inside allowed space')
	t.deepEqual(
		[...new Set(w.map(x => x.stop - x.start))].sort((a, b) => a - b),
		[100, 200],
		'widths come from the DMRs'
	)
	t.ok(
		w.every(x => x.chr == 'chr1'),
		'all on the requested chromosome'
	)
	t.end()
})

tape('sampleBackground is deterministic for a given seed', t => {
	const excl: [number, number][] = [[1000, 5000]]
	const a = sampleBackground('chr1', 20000, excl, [100], 50, 42)
	const b = sampleBackground('chr1', 20000, excl, [100], 50, 42)
	const c = sampleBackground('chr1', 20000, excl, [100], 50, 43)
	t.deepEqual(a, b, 'same seed gives the same windows -- the route caches this result')
	t.notDeepEqual(a, c, 'a different seed gives different windows')
	t.end()
})

tape('sampleBackground copes with space too small to hold a window', t => {
	// the only gap is 50bp; no 500bp window fits
	t.deepEqual(sampleBackground('chr1', 1000, [[50, 1000]], [500], 100, 1), [], 'no window rather than a bad one')
	t.deepEqual(sampleBackground('chr1', 1000, [], [], 100, 1), [], 'no DMR widths to match => nothing sampled')
	t.end()
})

/** A background with spread: 0.04, 0.05, 0.06 repeating, so the stratum's median is 0.05 and its robust
 * SD (1.4826 x MAD) is 0.014826. */
const spread = (n: number, base = 0.05) =>
	Array.from({ length: n }, (_, i) => ({ n_probes: 10, start: 0, stop: 1000, delta: base - 0.01 + (i % 3) * 0.01 }))

tape('scoreAgainstBackground reports excess over the stratum centre, tested against its fitted null', t => {
	const dmrs = [
		{ no_cpgs: 10, start: 0, stop: 1000, delta_beta_mean: 0.2 },
		{ no_cpgs: 10, start: 0, stop: 1000, delta_beta_mean: 0.05 }
	]
	const { scored } = scoreAgainstBackground(dmrs, spread(42))
	t.ok(Math.abs(scored[0]!.excess - 0.15) < 1e-9, 'a +0.20 DMR over a +0.05 centre has excess +0.15')
	t.ok(scored[0]!.p < 1e-20, `and is ~10 robust SDs out, so p is tiny (${scored[0]!.p.toExponential(2)})`)
	t.ok(Math.abs(scored[1]!.excess) < 1e-9, 'a DMR that only matched the drift has zero excess')
	t.equal(scored[1]!.p, 1, 'and p = 1')
	t.end()
})

tape('scoreAgainstBackground is two-sided about the centre, not about zero', t => {
	// a +0.01 DMR moved LESS than its stratum drifted (+0.05): a real hypo excess though its sign is positive
	const { scored } = scoreAgainstBackground([{ no_cpgs: 10, start: 0, stop: 1000, delta_beta_mean: 0.01 }], spread(42))
	t.ok(scored[0]!.excess < 0, 'the excess is negative')
	t.ok(scored[0]!.p < 0.01, `and significant on the lower side (p ${scored[0]!.p.toExponential(2)})`)
	t.end()
})

tape('buildExclusion cannot build an intergenic background without gene spans', async t => {
	const genome = { tracks: [{ name: 'ENCODE cCREs', file: 'anno/x.gz' }] }
	t.equal(
		await buildExclusion(genome, 'chr1', 1000, null),
		null,
		'no gene index => no correction, not a gene-blind one'
	)
	t.end()
})

tape('scoreAgainstBackground never reports p = 0', t => {
	const { scored } = scoreAgainstBackground([{ no_cpgs: 10, start: 0, stop: 1000, delta_beta_mean: 99 }], spread(42))
	t.ok(scored[0]!.p > 0, 'an absurd excess still gets a positive p')
	t.equal(scored[0]!.p, 1e-300, 'the floor, so -log10 p stays finite')
	t.end()
})

tape('a thin stratum yields no score rather than a bad one', t => {
	// only 5 background windows -- too few to estimate a mean or a tail
	const background = Array.from({ length: 5 }, () => ({ n_probes: 10, start: 0, stop: 1000, delta: 0.05 }))
	const { scored, unscored, strataUsed } = scoreAgainstBackground(
		[{ no_cpgs: 10, start: 0, stop: 1000, delta_beta_mean: 0.2 }],
		background
	)
	t.equal(scored[0], null, 'unscored rather than scored against 5 windows')
	t.equal(unscored, 1, 'and counted, so the caller can report the denominator')
	t.equal(strataUsed, 0, 'no stratum was usable')
	t.end()
})

tape('background with no usable delta is ignored', t => {
	const background = [
		...spread(30),
		{ n_probes: 0, start: 0, stop: 1000, delta: 0.9 },
		{ n_probes: 10, start: 0, stop: 1000, delta: null }
	]
	const { scored } = scoreAgainstBackground([{ no_cpgs: 10, start: 0, stop: 1000, delta_beta_mean: 0.2 }], background)
	t.ok(Math.abs(scored[0]!.excess - 0.15) < 1e-9, 'a probe-less window and a null delta do not move the centre')
	t.ok(BG_WINDOWS_PER_CHR > 0, 'the per-chromosome sample size is set')
	t.end()
})

tape('scanCpgs flags solo-WCGW CpGs: no CpG within 35 bp, A/T on both flanks', t => {
	const a = (n: number) => 'A'.repeat(n)
	// 0-based C positions: 40 solo W-CG-W; 120 and 130 are 10 bp apart; 199 is isolated but G-CG-C; 278 lower case
	const seq = a(40) + 'CG' + a(78) + 'CG' + a(8) + 'CG' + a(66) + 'G' + 'CG' + 'C' + a(76) + 'cg' + a(40)
	const { pos, solo } = scanCpgs(seq, 0, 0, seq.length)
	t.deepEqual(pos, [40, 120, 130, 199, 278], 'every CpG, lower case included')
	t.deepEqual(solo, [true, false, false, false, true], 'solo needs isolation AND W flanks; soft-masked counts')
	t.end()
})

tape('scanCpgs sees neighbours past the core edge', t => {
	// CpGs at 40 and 60, 20 bp apart; the core holds only 60
	const seq = 'A'.repeat(40) + 'CG' + 'A'.repeat(18) + 'CG' + 'A'.repeat(40)
	const { pos, solo } = scanCpgs(seq, 1000, 1050, 1102)
	t.deepEqual(pos, [1060], 'only the CpG inside the core, in genomic coordinates')
	t.deepEqual(solo, [false], 'not solo: its neighbour lies in the padding, outside the core')
	t.end()
})

tape('soloWcgwFractions sweeps the fasta in chunks and matches a one-pass scan', async t => {
	const file = 'files/hg38/fasta/test.fa' // chrA, 1000 bases, 70 per line
	const txt = await readFastaRegion(file, 'chrA', 1, 1000)
	const whole = txt.slice(txt.indexOf('\n') + 1).replace(/\n/g, '')
	const ref = scanCpgs(whole, 0, 0, whole.length)
	// in the matrix's coordinates: 1-based, inclusive, a DMR starting AT its first CpG's C
	const regions = [
		{ start: 1, stop: 1000 },
		{ start: 100, stop: 400 },
		{ start: 500, stop: 520 },
		{ start: ref.pos[3] + 1, stop: ref.pos[3] + 1 }
	]
	const expect = regions.map(r => {
		const idx = ref.pos.map((p, i) => i).filter(i => ref.pos[i] + 1 >= r.start && ref.pos[i] + 1 <= r.stop)
		return idx.length ? idx.filter(i => ref.solo[i]).length / idx.length : null
	})
	// 97-base chunks put many chunk edges inside the regions
	const swept = await sweepCpgs(file, 'chrA', 1000, 97)
	t.ok(ref.pos.length > 20, `the test sequence has CpGs to find (${ref.pos.length})`)
	t.deepEqual([...swept.pos], ref.pos, 'every CpG found once across chunk edges, at the right position')
	t.deepEqual([...swept.solo].map(Boolean), ref.solo, 'with the same solo-WCGW flags as a one-pass scan')
	const got = await soloWcgwFractions(file, 'chrA', 1000, regions, 97)
	t.deepEqual(got, expect, 'same shares as scanning the whole chromosome at once')
	t.equal(got[3], ref.solo[3] ? 1 : 0, "a region starting at a CpG's 1-based position counts that CpG")
	const none = [null, null, null, null]
	t.deepEqual(
		await soloWcgwFractions('NA', 'chrA', 1000, regions),
		none,
		'a genome without a sequence file gives no shares, so the strata fall back to density and width'
	)
	t.deepEqual(await soloWcgwFractions(file, 'chrZ', 1000, regions), none, 'so does a chromosome the fasta lacks')
	t.deepEqual(
		await soloWcgwFractions(file, 'chrA', 5000, regions),
		none,
		'and a chromosome length past the fasta, rather than failing the analysis'
	)
	t.end()
})

tape('solo-WCGW tertiles are cut among the windows that are scored', t => {
	// 60 usable windows with shares 0 to 0.98, and 120 without probes, all at share 0
	const usable = Array.from({ length: 60 }, (_, i) => ({
		n_probes: 10,
		start: 0,
		stop: 1000,
		delta: 0.05 + ((i % 3) - 1) * 0.01
	}))
	const empty = Array.from({ length: 120 }, () => ({ n_probes: 0, start: 0, stop: 1000, delta: null }))
	const share = [...usable.map((_, i) => i / 60), ...empty.map(() => 0)]
	const { strataUsed } = scoreAgainstBackground([], [...usable, ...empty], { dmrs: [], background: share })
	t.equal(strataUsed, 3, 'a third of the usable windows in each tertile, so all three are scorable')
	t.end()
})

tape('scoreAgainstBackground matches on solo-WCGW share when given', t => {
	// one density x width stratum; windows rich in solo-WCGW drift +0.10, poor ones do not drift
	const background = Array.from({ length: 60 }, (_, i) => ({
		n_probes: 10,
		start: 0,
		stop: 1000,
		delta: (i < 30 ? 0 : 0.1) + ((i % 3) - 1) * 0.005
	}))
	const share = background.map((_, i) => (i < 30 ? 0.1 : 0.9))
	const dmr = [{ no_cpgs: 10, start: 0, stop: 1000, delta_beta_mean: 0.1 }]
	const plain = scoreAgainstBackground(dmr, background)
	t.ok(Math.abs(plain.scored[0]!.excess - 0.05) < 1e-9, 'unmatched: +0.10 over the pooled +0.05 drift')
	t.equal(plain.soloMatched, false, 'and reported as not solo-matched')
	const matched = scoreAgainstBackground(dmr, background, { dmrs: [0.9], background: share })
	t.ok(
		Math.abs(matched.scored[0]!.excess) < 1e-9,
		'matched: a solo-rich DMR drifting like solo-rich windows has no excess'
	)
	t.equal(matched.soloMatched, true, 'reported as solo-matched')
	t.end()
})

tape('benjaminiHochberg gives step-up q in input order', t => {
	const q = benjaminiHochberg([0.01, 0.04, 0.03, 0.5]).map(x => Math.round(x * 1e6) / 1e6)
	t.deepEqual(q, [0.04, 0.053333, 0.053333, 0.5], 'monotone in p')
	t.deepEqual(benjaminiHochberg([]), [], 'an empty family')
	t.end()
})

tape('a stratum with no spread at all is not scored', t => {
	const flat = Array.from({ length: 40 }, () => ({ n_probes: 10, start: 0, stop: 1000, delta: 0.05 }))
	const { scored, unscored } = scoreAgainstBackground(
		[{ no_cpgs: 10, start: 0, stop: 1000, delta_beta_mean: 0.2 }],
		flat
	)
	t.equal(scored[0], null, 'no scale to measure an excess in')
	t.equal(unscored, 1, 'counted as unscored')
	t.end()
})

tape('nullCheck counts a tail heavier than the null past the calibration point', t => {
	// 95 windows at 0.04 / 0.05 / 0.06 and 5 far out: at p < 0.05 that reads as the 5% of a null that fits
	const bg = [
		...spread(95),
		...[0.3, -0.3, 0.35, -0.35, 0.4].map(v => ({ n_probes: 10, start: 0, stop: 1000, delta: 0.05 + v }))
	]
	const { nullCheck } = scoreAgainstBackground([], bg)
	t.equal(nullCheck.windows, 100, 'every window of a usable stratum is checked')
	t.equal(nullCheck.belowP001, 5, '5% beyond p = 0.001, where a null that fit the tail would put 0.1%')
	t.end()
})

tape('normalTwoSidedP is accurate into the far tail', t => {
	const rel = (a: number, b: number) => Math.abs(a - b) / b
	t.equal(normalTwoSidedP(0), 1, 'z = 0 gives 1')
	t.ok(rel(normalTwoSidedP(1.959964), 0.05) < 1e-5, 'z = 1.96 gives 0.05')
	t.ok(rel(normalTwoSidedP(-1.959964), 0.05) < 1e-5, 'symmetric in z')
	t.ok(rel(normalTwoSidedP(8), 1.2441921e-15) < 1e-5, 'z = 8 gives 1.24e-15 to within 1e-5 relative')
	t.equal(normalTwoSidedP(60), 1e-300, 'floored, never 0')
	t.end()
})

tape('tail calibration widens the null for a heavy-tailed background', t => {
	// 80 windows tight around 0.05 and 20 spread far out: the robust scale sees only the tight core
	const bg = Array.from({ length: 100 }, (_, i) => ({
		n_probes: 10,
		start: 0,
		stop: 1000,
		delta: i < 80 ? 0.05 + ((i % 3) - 1) * 0.001 : 0.05 + (i % 2 ? 1 : -1) * (0.02 + (i - 80) * 0.002)
	}))
	const { scored } = scoreAgainstBackground([{ no_cpgs: 10, start: 0, stop: 1000, delta_beta_mean: 0.08 }], bg)
	t.ok(scored[0]!.p > 0.05, 'a DMR inside the background tails is not significant')
	t.end()
})
