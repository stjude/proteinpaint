import tape from 'tape'
import { groupFilter, mergeGroups } from '../sashimi.ts'

/*
j2/sashimi.ts: junctions of two sample groups merged by coordinates with each group's share of samples and usage,
and the one-group filter each group's request is sent with.
*/

tape('\n', test => {
	test.comment('-***- j2/sashimi -***-')
	test.end()
})

tape('mergeGroups() pairs junctions across groups and drops those rare in both', test => {
	const arcs = mergeGroups(
		[
			{
				sampleTotal: 10,
				junctions: [
					{ start: 1, stop: 9, strand: '+', sampleCount: 6 },
					{ start: 2, stop: 5, strand: '+', sampleCount: 1 }
				]
			},
			{ sampleTotal: 4, junctions: [{ start: 1, stop: 9, strand: '+', sampleCount: 1 }] }
		],
		0.2
	)
	test.equal(arcs.length, 1, 'a junction under the share in both groups is left out')
	test.deepEqual(arcs[0].shares, [0.6, 0.25], 'each group its own share of its own samples')
	test.deepEqual(arcs[0].counts, [6, 1], 'sample counts kept for the tooltip')
	const one = mergeGroups(
		[{ sampleTotal: 10, junctions: [{ start: 1, stop: 9, strand: '-', sampleCount: 5 }] }, { junctions: [] }],
		0.1
	)
	test.deepEqual(one[0].shares, [0.5, 0], 'a junction absent from a group has share 0 there')
	test.end()
})

tape('mergeGroups() gives each junction its share of the reads at its busier splice site, per group', test => {
	// 1-9 and 1-5 share a donor, 5-9 an acceptor with 1-9; 20-30 shares neither site
	const g1 = {
		sampleTotal: 10,
		junctions: [
			{ start: 1, stop: 9, strand: '+', sampleCount: 10, totalReadCount: 90 },
			{ start: 1, stop: 5, strand: '+', sampleCount: 10, totalReadCount: 10 },
			{ start: 20, stop: 30, strand: '+', sampleCount: 10, totalReadCount: 7 }
		]
	}
	// the second group expresses the gene 10 times more and prefers the short junction
	const g2 = {
		sampleTotal: 10,
		junctions: [
			{ start: 1, stop: 9, strand: '+', sampleCount: 10, totalReadCount: 100 },
			{ start: 1, stop: 5, strand: '+', sampleCount: 10, totalReadCount: 900 },
			{ start: 5, stop: 9, strand: '+', sampleCount: 2, totalReadCount: 0 }
		]
	}
	const arcs = mergeGroups([g1, g2], 0.1)
	const at = (s: number, e: number) => arcs.find(a => a.start == s && a.stop == e)!
	test.deepEqual(at(1, 9).shares, [1, 1], 'every sample has reads of both junctions in both groups: shares saturate')
	test.deepEqual(at(1, 9).usage, [0.9, 0.1], 'usage tells the groups apart')
	test.deepEqual(at(1, 5).usage, [0.1, 0.9], 'the other junction from the same donor takes the rest')
	test.deepEqual(at(20, 30).usage, [1, 0], 'a junction that shares neither site has all of its reads')
	test.ok(at(20, 30).alone && !at(1, 9).alone, 'a junction alone at its splice sites is marked, as it has no choice')
	test.end()
})

tape('groupFilter() holds only that group, joined with the track filter', test => {
	const groupTw = {
		term: { values: { a: { key: 'a', list: [{ sampleId: 1 }] }, b: { key: 'b', list: [{ sampleId: 2 }] } } }
	}
	const f = groupFilter(groupTw, 'b')
	test.deepEqual(Object.keys(f.lst[0].tvs.term.values), ['b'], "the term lists only the group's own samples")
	test.equal(f.lst.length, 1, 'no track filter: the group alone')
	const tf = { type: 'tvslst', in: true, join: '', lst: [{ type: 'tvs', tvs: {} }] }
	const g = groupFilter(groupTw, 'a', tf)
	test.equal(g.join, 'and', 'joined with the track filter')
	test.equal(g.lst[1], tf, 'the track filter kept as is')
	test.end()
})
