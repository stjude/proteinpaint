import tape from 'tape'
import { isoformParts, isoformUsage, rankSumP, junctionUsage, junctionStarts, annotationOf } from '../tk'

/**
 * Tests
 *   - rankSumP matches R's wilcox.test(exact = FALSE), with and without ties
 *   - isoformUsage: each group's mean shares, and a BH-adjusted test per isoform with two groups
 *   - junctionUsage: per sample a first junction's reads over the body junction's, none under 10 body reads, the
 *     median reads per group, and a test per isoform with two groups
 *   - junctionStarts: each distinct first junction but the body one, with enough reads, in genomic order, tested
 *   - annotationOf: a category's color and order, a sample without a value
 *   - isoformParts: the most expressed isoforms apart, the rest as one part, no parts for a sample without expression
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

tape('junctionUsage', test => {
	// keys: 0 the body junction, 1 the first junction of 'a'; 'b' has none
	const sample = (group: string, first: number, body: number) => ({ name: '', group, junctionReads: [body, first] })
	const data = {
		expressedIsoforms: ['a', 'b'],
		junctions: {
			keys: [
				[100, 200],
				[10, 50]
			] as [number, number][],
			first: [1, null],
			reference: 0
		},
		samples: [
			sample('r', 30, 100),
			sample('r', 25, 100),
			sample('r', 35, 100),
			sample('r', 9, 9),
			sample('t', 20, 2000),
			sample('t', 25, 2500),
			sample('t', 10, 1000)
		]
	}
	const u = junctionUsage(data, ['a', 'b'], ['r', 't'])!
	test.deepEqual(u.junction, [[10, 50], null], 'should give each isoform its first junction, or none')
	test.deepEqual(
		u.ratio[0].map(v => (v === null ? null : Math.round(v * 100))),
		[30, 25, 35, null, 1, 1, 1],
		'should give a sample the ratio of the two, and none with fewer than 10 reads of the body junction'
	)
	test.ok(
		u.ratio[1].every(v => v === null),
		'and an isoform without a first junction none'
	)
	test.deepEqual(
		u.reads[0],
		[
			{ first: 30, reference: 100 },
			{ first: 20, reference: 2000 }
		],
		'should give the median reads of each junction per group, which show what a ratio does not'
	)
	test.ok(u.q![0]! < 0.1 && u.q![1] === null, 'should test an isoform with a first junction only')
	test.equal(junctionUsage({ ...data, junctions: undefined }, ['a'], ['r', 't']), undefined, 'none without junctions')
	test.end()
})

tape('junctionStarts', test => {
	// keys: 0 body, 1 a start used by isoforms a and b, 2 a start of c with few reads, 3 a start of d upstream of 1
	const s = (group: string, r: number[]) => ({ name: '', group, junctionReads: r })
	const data = {
		expressedIsoforms: ['a', 'b', 'c', 'd', 'e'],
		junctions: {
			keys: [
				[500, 600],
				[200, 300],
				[700, 800],
				[50, 100]
			] as [number, number][],
			first: [1, 1, 2, 3, 0],
			reference: 0
		},
		samples: [
			s('r', [100, 80, 1, 2]),
			s('r', [100, 90, 2, 3]),
			s('r', [100, 85, 1, 1]),
			s('t', [2000, 60, 1, 1500]),
			s('t', [1800, 70, 2, 1400]),
			s('t', [2200, 65, 1, 1600])
		]
	}
	const st = junctionStarts(data, ['r', 't'])
	test.deepEqual(
		st.map(x => x.key),
		[
			[50, 100],
			[200, 300]
		],
		'should list each start but the body junction, with enough reads in some group, in genomic order'
	)
	test.deepEqual(st[1].isoforms, ['a', 'b'], 'with the isoforms that start there')
	test.deepEqual(
		st[1].reads,
		[
			{ start: 85, reference: 100 },
			{ start: 65, reference: 2000 }
		],
		'and the median reads of it and of the body junction per group'
	)
	test.ok(
		st.every(x => x.q !== null && x.q < 0.2),
		'and a q per start with two groups'
	)
	test.deepEqual(junctionStarts({ ...data, junctions: undefined }, ['r', 't']), [], 'none without junctions')
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
