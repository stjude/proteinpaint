import tape from 'tape'
import { junctionKeysOf, pickJunctions } from '../termdb.methylationLocus.ts'

/*
Tests:
	junctionKeysOf() keys a model's introns as a junction file has them
	pickJunctions() picks the reference junction and each isoform's first junction, by strand
	pickJunctions() gives no first junction to an isoform without one with reads, and nothing without any
*/

tape('\n', t => {
	t.comment('-***- termdb.methylationLocus junctions -***-')
	t.end()
})

tape('junctionKeysOf() keys a model introns as a junction file has them', t => {
	t.deepEqual(
		junctionKeysOf({
			exon: [
				[300, 400],
				[100, 200]
			]
		}),
		[[199, 300]],
		'from one base before the end of an exon to the start of the next, in genomic order'
	)
	t.end()
})

tape('pickJunctions() picks the reference junction and each isoform first junction, by strand', t => {
	// a: exons 100-200, 300-400, 500-600; b: 250-400 (another start), 500-600; c, on -: 300-400, 500-600, 700-800
	const a = {
		strand: '+',
		exon: [
			[100, 200],
			[300, 400],
			[500, 600]
		] as [number, number][]
	}
	const b = {
		strand: '+',
		exon: [
			[250, 400],
			[500, 600]
		] as [number, number][]
	}
	const totals = new Map([
		['199.300', 10],
		['399.500', 50],
		['599.700', 5]
	])
	const p = pickJunctions([a, b], totals)!
	t.deepEqual(p.keys[p.reference], [399, 500], 'the reference is the junction in the most isoforms')
	t.deepEqual(p.keys[p.first[0]!], [199, 300], "an isoform's first junction is its 5' one")
	t.equal(p.first[1], p.reference, 'which can be the reference itself')
	const c = {
		strand: '-',
		exon: [
			[300, 400],
			[500, 600],
			[700, 800]
		] as [number, number][]
	}
	const q = pickJunctions([c], totals)!
	t.deepEqual(q.keys[q.first[0]!], [599, 700], "on the minus strand, the 5' junction is the last in genomic order")
	t.end()
})

tape('pickJunctions() gives no first junction to an isoform without one with reads, and nothing without any', t => {
	const a = {
		strand: '+',
		exon: [
			[100, 200],
			[300, 400]
		] as [number, number][]
	}
	const b = {
		strand: '+',
		exon: [
			[1000, 1100],
			[1200, 1300]
		] as [number, number][]
	}
	const p = pickJunctions([a, b], new Map([['199.300', 3]]))!
	t.equal(p.first[1], null, 'an isoform whose junctions have no reads has none')
	t.equal(pickJunctions([b], new Map([['199.300', 3]])), undefined, 'and with no junction with reads, nothing')
	t.end()
})
