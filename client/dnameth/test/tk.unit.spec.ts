import tape from 'tape'
import { isoformParts, isoformUsage, annotationOf, dmrColor, groupMakeups } from '../tk'
import { rankSumP } from '#shared/rankSum.js'

/**
 * Tests
 *   - rankSumP matches R's wilcox.test(exact = FALSE), with and without ties
 *   - isoformUsage: each group's mean shares, and a BH-adjusted test per isoform with two groups
 *   - annotationOf: a category's color and order, a sample without a value
 *   - isoformParts: the most expressed isoforms apart, the rest as one part, no parts for a sample without expression
 *   - isoformParts with two groups: the isoforms by p of their share, q over all tested, none for a share near 0, none
 *     when a group has too few samples with a makeup
 *   - dmrColor: light at the smallest |Δβ| to dark at the largest, blue for hypo, orange for hyper
 */

tape('\n', test => {
	test.comment('-***- dnameth/tk -***-')
	test.end()
})

tape('isoformParts', test => {
	const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
	const parts = isoformParts({
		expressedIsoforms: ids,
		isoformUnit: 'TPM',
		samples: [
			{ isoformValues: [1, 2, 3, 4, 5, 6, 9] },
			{ isoformValues: [0, 0, 0, 0, 0, 0, 0] },
			{},
			{ isoformValues: [1, 2, 3, 4, 5, 6, null] }
		]
	})!
	test.deepEqual(
		parts.labels,
		['g', 'f', 'e', 'd', 'c', '2 other isoforms'],
		'should list the 5 most expressed, then the rest'
	)
	test.equal(parts.colors.length, 6, 'should give each part a color')
	test.deepEqual(
		parts.shares[0].map(v => Math.round(v * 30)),
		[9, 6, 5, 4, 3, 3],
		"should give each part its share of the sample's isoform expression, the rest summed"
	)
	test.deepEqual(parts.shares[1], [], 'should give no parts to a sample whose isoforms add up to nothing')
	test.deepEqual(
		isoformParts({
			expressedIsoforms: ['a', 'b'],
			samples: [{ isoformValues: [5, 5] }, { isoformValues: [0.3, 0.6] }]
		})!.shares[1],
		[],
		'and none to a sample whose isoforms sum to under 1, where a read or two decides a share'
	)
	test.deepEqual(parts.shares[2], [], 'and none to a sample without isoform values')
	test.deepEqual(parts.shares[3], [], 'and none to a sample missing the value of an isoform, whose makeup is not known')
	test.equal(parts.unit, 'TPM', "should name the isoforms' unit")
	test.deepEqual(
		isoformParts({ expressedIsoforms: ['a', 'b'], samples: [{ isoformValues: [4, 6] }] })!.shares[0].map(v =>
			Math.round(v * 100)
		),
		[60, 40],
		'should give the shares unrounded'
	)
	test.equal(
		isoformParts({ expressedIsoforms: ['a'], samples: [{ isoformValues: [1] }] }),
		undefined,
		'should give none for one isoform'
	)
	test.end()
})

tape('rankSumP', test => {
	const close = (a: number | null, b: number) => a !== null && Math.abs(a - b) < 1e-6
	test.ok(close(rankSumP([1, 2, 3, 4, 5], [6, 7, 8, 9, 10]), 0.0121857803553448), 'should match R without ties')
	test.ok(
		close(rankSumP([0.1, 0.2, 0.2, 0.5, 0.9, 0.9], [0.2, 0.6, 0.7, 0.9, 0.95]), 0.306341437827711),
		'should match R with ties'
	)
	test.equal(rankSumP([], [1, 2]), null, 'should give null with an empty group')
	test.equal(rankSumP([1, 1], [1, 1]), null, 'and with no variation')
	test.end()
})

tape('isoformUsage', test => {
	const shares = [[0.9, 0.1], [0.8, 0.2], [0.7, 0.3], [], [0.2, 0.8], [0.1, 0.9], [0.3, 0.7]]
	const samples = ['a', 'a', 'a', 'a', 'b', 'b', 'b'].map(group => ({ group }))
	const u = isoformUsage(shares, samples, ['a', 'b'])!
	test.deepEqual(
		u.groups.map(g => [g.name, g.n, g.mean.map(m => Math.round(m * 100))]),
		[
			['a', 3, [80, 20]],
			['b', 3, [20, 80]]
		],
		'should give each group its mean shares over the samples with a makeup'
	)
	test.equal(u.q!.length, 2, 'should test each isoform with two groups')
	test.ok(
		u.q!.every(q => q !== null && q < 0.1),
		'and find the switch'
	)
	test.equal(isoformUsage(shares, samples, ['a', 'b', 'c'])!.q, undefined, 'should not test more than two groups')
	test.equal(isoformUsage(shares, samples, []), undefined, 'should give nothing without groups')
	test.end()
})

tape('annotationOf', test => {
	const tk = {
		annotationTw: {
			term: { name: 'Class', type: 'categorical', values: { x: { label: 'X', color: 'red' }, y: { label: 'Y' } } }
		}
	}
	const samples = [{ name: '1', annotation: 'y' }, { name: '2', annotation: 'x' }, { name: '3' }]
	const a = annotationOf(tk, { samples })!
	test.deepEqual(
		a.legend,
		[
			['X', 'red'],
			['Y', a.legend[1][1]]
		],
		"should give each category its label and the term's color"
	)
	test.deepEqual(
		samples.map(s => a.rank(s)),
		[1, 0, Infinity],
		'should order the categories as the term lists them, a sample without a value last'
	)
	test.equal(a.text(samples[2]), 'no value', 'and say a sample has none')
	test.deepEqual(a.column(samples).colors, [a.legend[1][1], 'red', '#fff'], 'a column of the colors, white for none')
	test.equal(annotationOf({}, { samples }), undefined, 'none without an annotation')
	test.end()
})

tape('isoformParts with two groups', test => {
	/* every sample sums to 100, so a value is its share: a, the most expressed, has the same share in both groups; b
	rises and c falls between them; g is near 0 in both and differs, so it is not tested */
	const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
	const ref = (j: number) => ({ group: 'ref', isoformValues: [50, 10 + j / 10, 15 - j / 10, 10, 10, 4.99, 0.01] })
	const t414 = (j: number) => ({ group: 't414', isoformValues: [50, 20 + j / 10, 5 - j / 10, 10, 10, 4.8, 0.2] })
	const samples = [1, 2, 3, 4, 5, 6].flatMap(j => [ref(j), t414(j)])
	const parts = isoformParts({ expressedIsoforms: ids, samples, groups: ['ref', 't414'] })!
	// f, which shifts by a little but the same in every sample, ties more and so has the smallest p of all
	test.deepEqual(parts.ids.slice(0, 3), ['f', 'b', 'c'], 'should put the isoforms whose share differs first, by p')
	test.notEqual(parts.ids[0], 'a', 'and not the most expressed isoform when its share does not differ')
	test.ok(!parts.ids.includes('g'), 'should not pick an isoform whose share is near 0 in both groups')
	test.equal(parts.q!.length, parts.labels.length, 'should give a q per part')
	test.equal(parts.q![parts.q!.length - 1], null, 'and none for the other isoforms')
	test.equal(parts.q![parts.ids.indexOf('a')], null, 'nor for one with no difference to test')
	test.ok(parts.q![0]! < 0.05, 'should find the shift of b')
	const byExpr = isoformParts({ expressedIsoforms: ids, samples })!
	test.equal(byExpr.ids[0], 'a', 'without groups, should pick by expression')
	test.equal(byExpr.q, undefined, 'and test nothing')
	// a gene under minIsoformTotal in nearly every sample, e.g. FBN2 in plasma cells: 2 makeups in one group, none in the other
	const few = [
		...samples.filter(s => s.group == 't414').slice(0, 2),
		...samples.map(s => ({ ...s, isoformValues: ids.map(() => 0.1) }))
	]
	test.equal(
		isoformParts({ expressedIsoforms: ids, samples: few, groups: ['ref', 't414'] }),
		undefined,
		'should give none when a group has too few samples with a makeup'
	)
	test.deepEqual(
		groupMakeups({ expressedIsoforms: ids, samples: few, groups: ['ref', 't414'] }),
		[
			{ name: 'ref', n: 0 },
			{ name: 't414', n: 2 }
		],
		"and count each group's samples with a makeup, for the legend"
	)
	test.end()
})

tape('dmrColor', test => {
	const c = dmrColor(0.1, 0.3)
	const light = (x: string) =>
		x
			.match(/\d+/g)!
			.map(Number)
			.reduce((a, b) => a + b, 0)
	test.ok(light(c(-0.1)) > light(c(-0.3)), 'should be lighter at the smallest |Δβ| than at the largest')
	test.ok(light(c(0.1)) > light(c(0.3)), 'on both sides')
	const [r, , b] = c(-0.3).match(/\d+/g)!.map(Number)
	test.ok(b > r, 'should be blue for hypo')
	const [r2, , b2] = c(0.3).match(/\d+/g)!.map(Number)
	test.ok(r2 > b2, 'and orange for hyper')
	test.equal(c(-0.9), c(-0.3), 'with the end color past the largest')
	test.equal(dmrColor(0.2, 0.2)(-0.2), c(-0.3), 'and the darkest for a single size')
	test.end()
})
