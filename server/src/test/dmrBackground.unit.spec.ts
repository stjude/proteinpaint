import tape from 'tape'
import { sampleBackground, scoreAgainstBackground, BG_WINDOWS_PER_CHR } from '#src/utils/dmrBackground.ts'

/*
test sections:

sampleBackground: windows avoid excluded space, match the DMR widths, and are deterministic
scoreAgainstBackground: excess and empirical p, and the resolution floor
scoreAgainstBackground: a stratum with too little background yields no score rather than a bad one
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

tape('scoreAgainstBackground reports excess over the stratum mean', t => {
	// 40 background windows in one stratum, all drifting +0.05
	const background = Array.from({ length: 40 }, () => ({ n_probes: 10, start: 0, stop: 1000, delta: 0.05 }))
	const dmrs = [
		{ no_cpgs: 10, start: 0, stop: 1000, meandiff: 0.2 },
		{ no_cpgs: 10, start: 0, stop: 1000, meandiff: 0.05 }
	]
	const { scored } = scoreAgainstBackground(dmrs, background)
	t.ok(Math.abs(scored[0]!.excess - 0.15) < 1e-9, 'a +0.20 DMR over +0.05 drift has excess +0.15')
	t.ok(Math.abs(scored[1]!.excess) < 1e-9, 'a DMR that only matched the drift has zero excess')
	t.equal(scored[0]!.p, 1 / 41, 'nothing in the background reached +0.20; p is the 1/(n+1) floor')
	t.equal(scored[1]!.p, 41 / 41, 'all of it reached +0.05')
	t.end()
})

tape('scoreAgainstBackground never reports p = 0', t => {
	const background = Array.from({ length: 100 }, (_, i) => ({ n_probes: 10, start: 0, stop: 1000, delta: i / 1000 }))
	const { scored } = scoreAgainstBackground([{ no_cpgs: 10, start: 0, stop: 1000, meandiff: 99 }], background)
	t.ok(scored[0]!.p > 0, 'an unreachable observation still gets the floor, not zero')
	t.equal(scored[0]!.p, 1 / 101, 'which is 1/(n+1)')
	t.end()
})

tape('a thin stratum yields no score rather than a bad one', t => {
	// only 5 background windows -- too few to estimate a mean or a tail
	const background = Array.from({ length: 5 }, () => ({ n_probes: 10, start: 0, stop: 1000, delta: 0.05 }))
	const { scored, unscored, strataUsed } = scoreAgainstBackground(
		[{ no_cpgs: 10, start: 0, stop: 1000, meandiff: 0.2 }],
		background
	)
	t.equal(scored[0], null, 'unscored rather than scored against 5 windows')
	t.equal(unscored, 1, 'and counted, so the caller can report the denominator')
	t.equal(strataUsed, 0, 'no stratum was usable')
	t.end()
})

tape('background with no usable delta is ignored', t => {
	const background = [
		...Array.from({ length: 30 }, () => ({ n_probes: 10, start: 0, stop: 1000, delta: 0.05 })),
		{ n_probes: 0, start: 0, stop: 1000, delta: 0.9 },
		{ n_probes: 10, start: 0, stop: 1000, delta: null }
	]
	const { scored } = scoreAgainstBackground([{ no_cpgs: 10, start: 0, stop: 1000, meandiff: 0.2 }], background)
	t.ok(Math.abs(scored[0]!.excess - 0.15) < 1e-9, 'a probe-less window and a null delta do not move the mean')
	t.ok(BG_WINDOWS_PER_CHR > 0, 'the per-chromosome sample size is set')
	t.end()
})
