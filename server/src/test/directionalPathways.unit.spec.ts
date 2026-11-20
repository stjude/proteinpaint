import tape from 'tape'
import {
	chiSquareLogSf,
	hypergeometricLogSf,
	mergeDirectionalP,
	rankedHypergeometric,
	logBH,
	pathwayEnrichment,
	layeredPathways
} from '#src/utils/directionalPathways.ts'

/*
test sections:

chiSquareLogSf: matches R's pchisq(log.p = TRUE), integer and non-integer df, far tails
hypergeometricLogSf: matches R's phyper upper tail, including the impossible and certain ends
mergeDirectionalP: Brown's merge (no constraint) and DPM with same-direction and inverse constraints match the
	published reference implementation on a 10-gene, 2-layer example
rankedHypergeometric: best prefix p and its overlap match the reference implementation
logBH: Benjamini-Hochberg on log p
pathwayEnrichment: sets are cut to the background and filtered by size; a set packed at the top of the list wins
layeredPathways: per layer and merged; a set whose genes change opposite ways passes alone but not merged
*/

/* The expected numbers came from R: base pchisq and phyper, and the ActivePathways 2.0.6 R source loaded with
source() for merge_p_values(method 'DPM' / 'Brown') and orderedHypergeometric. */

const close = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b))

tape('\n', t => {
	t.comment('-***- directionalPathways specs -***-')
	t.end()
})

tape('chiSquareLogSf matches pchisq', t => {
	for (const [x, df, want] of [
		[3.841458820694124, 1, -2.9957322735539913],
		[18.307038053275146, 10, -2.9957322735539891],
		[3, 2.5, -1.1846617048495762],
		[0.5, 7.3, -0.00036343373727807017],
		[700, 4, -344.13921377653412],
		[2500, 3.6, -1244.2235573697974],
		[40, 40.5, -0.70797696987572123]
	])
		t.ok(close(chiSquareLogSf(x, df), want), `chi-square(${df}) tail at ${x}: ${chiSquareLogSf(x, df)} vs ${want}`)
	t.equal(chiSquareLogSf(0, 4), 0, 'should be ln 1 at 0')
	t.end()
})

tape('hypergeometricLogSf matches phyper', t => {
	for (const [x, pop, marked, draws, want] of [
		[3, 100, 10, 20, -1.1432542694847665],
		[1, 50, 5, 5, -0.85952931399625765],
		[20, 12000, 400, 200, -11.361341529587326],
		[40, 12000, 300, 200, -56.234649942880864]
	])
		t.ok(close(hypergeometricLogSf(x, pop, marked, draws), want), `P(X >= ${x}) of ${draws} from ${marked}/${pop}`)
	t.equal(hypergeometricLogSf(0, 30, 5, 5), 0, 'should be certain at 0')
	t.equal(hypergeometricLogSf(6, 30, 5, 5), -Infinity, 'should be impossible past the marked count')
	t.end()
})

// 10 genes, layers rna and meth: p-values and signs of change
const P = [
	[0.001, 0.01],
	[0.02, 0.2],
	[0.3, 0.6],
	[0.8, 0.7],
	[1e-8, 1e-6],
	[0.5, 0.03],
	[0.04, 0.001],
	[0.9, 0.4],
	[0.0005, 0.002],
	[0.07, 0.9]
]
const DIR = [
	[1, 1],
	[-1, -1],
	[1, -1],
	[-1, 1],
	[1, 1],
	[1, -1],
	[-1, -1],
	[1, 1],
	[-1, -1],
	[1, -1]
]

tape('mergeDirectionalP matches the reference implementation', t => {
	const cases: [string, number[], number[][], number[]][] = [
		[
			'Brown, no direction',
			[0, 0],
			P.map(() => [0, 0]),
			[
				-7.0452942856531111, -3.113119450820105, -0.78587534794337988, -0.20024286645102476, -21.127547982230038,
				-2.2763100845243525, -6.1230198866457783, -0.41328602504223572, -8.5870009540789454, -1.3961177834067295
			]
		],
		[
			'DPM, same direction',
			[1, 1],
			DIR,
			[
				-7.0452942856531111, -3.113119450820105, -0.25218673886397919, -0.028264857113259378, -21.127547982230038,
				-1.4253429267188686, -6.1230198866457783, -0.41328602504223572, -8.5870009540789454, -1.2706327080794797
			]
		],
		[
			'DPM, inverse',
			[1, -1],
			DIR,
			[
				-1.1226985786336525, -1.1226985786336525, -0.78587534794337988, -0.20024286645102476, -2.530946603885647,
				-2.2763100845243525, -1.9587475431903698, -0.30834956815357129, -0.60505141211132119, -1.3961177834067295
			]
		]
	]
	for (const [label, constraints, dir, want] of cases) {
		const got = mergeDirectionalP(P, dir, constraints)
		t.ok(
			got.every((v, i) => close(v, want[i], 1e-8)),
			`${label}: ${got.map(v => v.toFixed(6)).join(' ')}`
		)
	}
	t.end()
})

tape('rankedHypergeometric matches the reference implementation', t => {
	const ordered = ['g1', 'g5', 'g9', 'g2', 'g30', 'g7', 'g40', 'g3', 'g50', 'g11']
	const set = new Set(['g1', 'g9', 'g7', 'g3', 'g100', 'g101', 'g102', 'g103', 'g104', 'g105'])
	const r = rankedHypergeometric(ordered, 200, set)
	t.ok(close(r.logP, -8.4890979470929313), `best prefix ln p ${r.logP}`)
	t.deepEqual(r.overlap, ['g1', 'g9', 'g7', 'g3'], 'should end the best prefix at the 8th gene, g3')
	t.deepEqual(rankedHypergeometric(['a', 'b'], 10, new Set(['z'])), { logP: 0, overlap: [] }, 'p 1 with no member')
	t.end()
})

tape('logBH', t => {
	const q = logBH([0.01, 0.04, 0.03, 0.5].map(Math.log)).map(Math.exp)
	// R: p.adjust(c(0.01, 0.04, 0.03, 0.5), 'BH')
	const want = [0.04, 0.16 / 3, 0.16 / 3, 0.5]
	t.ok(
		q.every((v, i) => close(v, want[i])),
		`q ${q.join(' ')}`
	)
	t.end()
})

tape('pathwayEnrichment', t => {
	const background = Array.from({ length: 100 }, (_, i) => `g${i}`)
	// g0..g9 most significant, then the rest by index
	const logP = background.map((_, i) => Math.log(1e-6 * (i + 1)))
	const sets = {
		top: background.slice(0, 12),
		spread: background.filter((_, i) => i % 8 == 0),
		small: ['g0', 'g1'],
		outside: [...background.slice(50, 60), 'notInBackground']
	}
	const r = pathwayEnrichment({ genes: background, logP, background, sets, cutoff: 0.1, sizeRange: [5, 500] })
	t.deepEqual(
		r.map(x => x.id),
		['top', 'spread', 'outside'],
		'should drop the set under the size floor and keep the order of the input'
	)
	t.equal(r.find(x => x.id == 'outside')!.size, 10, 'should count only background genes in a set')
	const top = r.find(x => x.id == 'top')!
	t.ok(top.logQ < Math.log(1e-10) && top.logQ <= r.find(x => x.id == 'spread')!.logQ, 'the top-packed set should win')
	t.end()
})

tape('layeredPathways', t => {
	// 60 genes: g0-g11 change in both layers the same way, g12-g23 in both but opposite ways, the rest barely
	const genes = Array.from({ length: 60 }, (_, i) => `g${i}`)
	const p = genes.map((_, i) =>
		i < 12 ? [1e-6 * (i + 1), 1e-6 * (i + 1)] : i < 24 ? [1e-5 * i, 1e-5 * i] : [0.3, 0.4]
	)
	const direction = genes.map((_, i) => (i < 12 ? [1, 1] : i < 24 ? [1, -1] : i % 2 ? [1, -1] : [-1, -1]))
	const sets = { agree: genes.slice(0, 12), opposite: genes.slice(12, 24) }
	const r = layeredPathways({ genes, p, direction, constraints: [1, 1], sets, cutoff: 0.05, sizeRange: [5, 100] })
	t.deepEqual(
		r.sets.map(s => s.id),
		['agree', 'opposite'],
		'should keep the sets in input order'
	)
	t.deepEqual(r.passing, [24, 24, 12], 'should count the genes at the cutoff per layer, then merged')
	t.ok(r.brown.df > 0 && r.brown.df <= 4, `Brown df ${r.brown.df} should be within (0, 2k]`)
	const [agree, opposite] = r.sets
	t.ok(
		agree.layers.every(l => l.log10q < Math.log10(0.05)),
		'a set changing the same way in both layers should pass alone and merged'
	)
	t.deepEqual(
		agree.layers.map(l => l.direction),
		[1, 1, 1],
		'should give each layer its genes direction'
	)
	t.deepEqual(agree.genes, sets.agree, 'should list the merged layer genes, most significant first')
	t.ok(
		opposite.layers[0].log10q < Math.log10(0.05) && opposite.layers[1].log10q < Math.log10(0.05),
		'a set changing opposite ways should pass in each layer alone'
	)
	t.ok(
		opposite.layers[2].log10q >= Math.log10(0.05),
		'and should not pass once merged under the same-direction constraint'
	)
	t.equal(opposite.layers[1].direction, -1, 'should give the second layer its own direction')
	t.end()
})
