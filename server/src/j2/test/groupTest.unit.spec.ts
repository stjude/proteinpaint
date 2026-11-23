import tape from 'tape'
import { testJunctionGroups, minJunctionShare, minJunctionSamples, junctionGene } from '../validate.ts'

/*
Tests:
	junctionGene() is the gene of both ends, else of the one annotated end, and none for two genes or none
	testJunctionGroups() tests a junction's share of its gene's junction reads, not its read count
	testJunctionGroups() does not dilute a neighboring gene's junctions when one gene rises
	testJunctionGroups() leaves out samples without reads of the gene, and tests nothing without a group
	testJunctionGroups() does not test a junction below minJunctionShare in both groups, but gives its shares
	testJunctionGroups() does not test a junction in fewer than minJunctionSamples samples
*/

tape('\n', t => {
	t.comment('-***- j2 testJunctionGroups -***-')
	t.end()
})

tape('junctionGene() is the gene of both ends, else of the one annotated end, none for two genes or none', t => {
	const end = (gene: string) => [{ gene, isoform: 'x', strand: '+' }]
	t.equal(junctionGene({ exonleft: end('NSD2'), exonright: end('NSD2') }), 'NSD2', 'both ends in one gene')
	t.equal(junctionGene({ intronleft: end('NSD2'), exonright: end('NSD2') }), 'NSD2', 'an end in an intron counts')
	t.equal(junctionGene({ exonright: end('NSD2') }), 'NSD2', 'the only annotated end')
	t.equal(
		junctionGene({ exonleft: end('UVSSA'), exonright: end('NSD2') }),
		undefined,
		'none for a junction of two genes'
	)
	t.equal(junctionGene({ site: 'GT-AG' }), undefined, 'none for a junction of no gene')
	t.equal(
		junctionGene({ exonleft: [...end('B'), ...end('A')], exonright: [...end('A'), ...end('B')] }),
		'A',
		'the first by name of genes on both ends'
	)
	t.end()
})

/* gene G: a body junction b that group B makes 10x more of, and a start s whose reads are the same in both; gene N, a
neighbor: a junction n with the same reads in both groups */
function fixture() {
	const b: any = { start: 1, stop: 2 },
		s: any = { start: 3, stop: 4 },
		n: any = { start: 5, stop: 6 }
	const groupOf = new Map<string, string>()
	const reads = { b: new Map<string, number>(), s: new Map<string, number>(), n: new Map<string, number>() }
	for (let i = 0; i < 8; i++) {
		groupOf.set(`a${i}`, 'A').set(`b${i}`, 'B')
		reads.b.set(`a${i}`, 100 + i).set(`b${i}`, 1000 + i * 10)
		reads.s.set(`a${i}`, 20 + i).set(`b${i}`, 20 + i)
		reads.n.set(`a${i}`, 50 + i).set(`b${i}`, 50 + i)
	}
	const groupReads = new Map<any, { gene: string; reads: Map<string | number, number> }>([
		[b, { gene: 'G', reads: reads.b }],
		[s, { gene: 'G', reads: reads.s }],
		[n, { gene: 'N', reads: reads.n }]
	])
	const geneTotal = new Map<string, Map<string | number, number>>()
	for (const { gene, reads: r } of groupReads.values()) {
		if (!geneTotal.has(gene)) geneTotal.set(gene, new Map())
		const tot = geneTotal.get(gene)!
		for (const [id, rc] of r) tot.set(id, (tot.get(id) || 0) + rc)
	}
	return { b, s, n, groupOf, groupReads, geneTotal, groups: { groupOf, names: ['A', 'B'] as [string, string] } }
}

tape('testJunctionGroups() tests a junction share of its gene, not its read count', t => {
	const { b, s, n, groupReads, geneTotal, groups } = fixture()
	const out = testJunctionGroups([b, s, n], groupReads, geneTotal, groups)
	t.deepEqual(out.groups, [
		{ name: 'A', n: 8 },
		{ name: 'B', n: 8 }
	])
	t.ok(s.p < 0.01, 'the start keeps its reads but loses its share of the gene: a difference')
	t.ok(s.groupShares[0] > s.groupShares[1], 'with the higher share in A')
	t.ok(b.groupShares[1] > b.groupShares[0], 'and the body junction the higher share in B')
	t.equal(s.gene, 'G', 'with the gene of the share')
	t.ok(s.q >= s.p, 'q is not below p')
	t.end()
})

tape('testJunctionGroups() does not dilute a neighboring gene when one gene rises', t => {
	const { b, s, n, groupReads, geneTotal, groups } = fixture()
	testJunctionGroups([b, s, n], groupReads, geneTotal, groups)
	t.deepEqual(n.groupShares, [1, 1], 'the only junction of N is all of its reads in both groups')
	t.equal(n.p, undefined, 'and has no difference to test')
	t.end()
})

tape('testJunctionGroups() leaves out samples without reads of the gene, and tests nothing without a group', t => {
	const { b, s, n, groupOf, groupReads, geneTotal, groups } = fixture()
	groupOf.set('c0', 'B') // in a group, no junction reads
	const out = testJunctionGroups([b, s, n], groupReads, geneTotal, groups)
	t.equal(out.groups[1].n, 8, 'a sample without junction reads is not counted')
	const one = new Map([['a0', 'A']])
	const j: any = { start: 7, stop: 8 }
	testJunctionGroups(
		[j],
		new Map([[j, { gene: 'G', reads: new Map([['a0', 5]]) }]]),
		new Map([['G', new Map([['a0', 5]])]]),
		{ groupOf: one, names: ['A', 'B'] }
	)
	t.equal(j.groupShares, undefined, 'a gene with samples of one group only is not tested')
	t.end()
})

tape('testJunctionGroups() does not test a junction below minJunctionShare in both groups', t => {
	const { b, s, groupOf, groupReads, geneTotal, groups } = fixture()
	// in every sample of B and none of A, at far less than the least share tested
	const rare: any = { start: 7, stop: 8 }
	const r = new Map([...groupOf].filter(([, g]) => g == 'B').map(([id]) => [id, 1] as [string, number]))
	groupReads.set(rare, { gene: 'G', reads: r })
	for (const [id, rc] of r) geneTotal.get('G')!.set(id, geneTotal.get('G')!.get(id)! + rc)
	testJunctionGroups([b, s, rare], groupReads, geneTotal, groups)
	t.ok(rare.groupShares[1] < minJunctionShare, 'the fixture is below the least share')
	t.equal(rare.p, undefined, 'it is not tested, as its presence alone would give a tiny p')
	t.ok(Number.isFinite(s.p), 'the others still are')
	t.end()
})

tape('testJunctionGroups() does not test a junction in fewer than minJunctionSamples samples', t => {
	const { b, s, groupReads, geneTotal, groups } = fixture()
	// one sample of B with a large share, none of the rest
	const one: any = { start: 9, stop: 10 }
	groupReads.set(one, { gene: 'G', reads: new Map([['b0', 500]]) })
	geneTotal.get('G')!.set('b0', geneTotal.get('G')!.get('b0')! + 500)
	testJunctionGroups([b, s, one], groupReads, geneTotal, groups)
	t.ok(minJunctionSamples > 1 && one.groupShares[1] > minJunctionShare, 'the fixture passes the least share')
	t.equal(one.p, undefined, 'but is in one sample only, and is not tested')
	t.end()
})
