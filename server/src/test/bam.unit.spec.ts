/********************************************
Unit Test for parse_align_output, get_partstack, may_trimstacks and read_regions (server/src/bam.js)
Run with:  node server/src/test/bam.unit.spec.ts
*********************************************/

import tape from 'tape'
import { parse_align_output, get_partstack, may_trimstacks, read_limits, read_regions } from '../bam.js'

tape('bam.js - parse_align_output', async t => {
	const multiSeqClustal =
		'Multiple Sequencing Alignment\n\nseq  AGGGATTAGAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAGCAGAGGTGAGATGATT\nseq  --------------------------------------TTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACAGGCTCGTGGAAGGCATGCTCCCATGTGTGGCAGG-----------------------------------------------------------------\nseq  -----------------------------------------------------------GCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACAGGCTCGTGAATGGCATGCTCCAAAGTGTGGCAGGAGGGTTTCCCGAGGCCCCAAA--------------------------------------------\nseq  ---------------------------------------------------------------------------------------AGAAATCCTGACTTACAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAG----------------\nseq  ---------------------------------------------------------------------------------------AGAAATCCTGACTTACAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGGAGGGTTCCCCGAGCCCCCAATAGATTGGGATTTTTGTCCAGGGACTGAG----------------\nseq  -----------------------------------------------------------------------------------------------TGACTTACAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAGCAGAGGTG--------\n                                                                                                    ***************** * ********** * *********                                                                  \n\n'
	const qual_sequence =
		'39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,38,39,39,39,39,39,39,39,39,39,39,39,38,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,37,39,39,37,39,39,39,39,39,37,39,39,39,39,39,39,37,33,39,31,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2\n39,39,37,39,39,39,39,39,39,39,37,39,39,38,39,38,39,37,39,39,39,37,39,39,39,39,39,39,36,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,37,36,39,38,39,39,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2\n32,36,32,32,33,33,35,36,37,36,35,37,35,37,37,36,28,39,38,39,36,37,38,36,38,38,32,38,36,34,37,38,38,38,35,38,38,38,37,38,36,35,36,37,36,40,36,37,35,37,39,39,39,37,39,39,37,39,39,37,39,36,39,39,39,38,38,36,38,38,39,38,38,39,39,38,38,38,38,38,36,37,37,36,37,38,38,37,36,38,38,38,38,38,37,36,38,38,38,38\n37,37,37,37,37,37,37,37,37,37,37,37,37,37,37,37,37,37,37,36,37,37,30,16,34,21,29,19,22,30,18,8,19,19,19,30,28,31,9,30,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2\n36,37,36,36,36,35,23,34,36,38,36,34,36,34,37,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,38,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39,39\n'
	const leftflankseq_length = 101
	const partstack_start = 0
	const partstack_stop = 0
	const reference_sequence =
		'AGGGATTAGAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAGCAGAGGTGAGATGATT'
	try {
		const result = parse_align_output(
			multiSeqClustal,
			qual_sequence,
			leftflankseq_length,
			partstack_start,
			partstack_stop,
			reference_sequence
		)
		t.ok(result, 'Should return a result object')
		t.equal(typeof result, 'object', 'Result should be an object')

		// Core structure validation
		t.ok(Array.isArray(result.final_read_align), 'final_read_align should be array')
		t.ok(Array.isArray(result.qual_r), 'qual_r should be array')
		t.ok(Array.isArray(result.qual_g), 'qual_g should be array')

		// Check count matches number of sequences
		t.equal(result.final_read_align.length, 6, 'Should have 6 aligned sequences')
		t.equal(result.qual_r.length, 6, 'Should have 6 qual_r entries')
		t.equal(result.qual_g.length, 6, 'Should have 6 qual_g entries')

		t.equal(result.gaps_before_variant, 0, 'gaps_before_variant should be 0')
		t.equal(result.read_count, 5, 'read_count should be 5')
	} catch (err: any) {
		t.fail(`Failed to parse the output of alignment: ${err.message}`)
	}
	t.end()
})

tape('bam.js - get_partstack', t => {
	t.equal(get_partstack({}), undefined, 'should return undefined without a stack range')
	t.deepEqual(get_partstack({ stackstart: 0, stackstop: 0 }), { start: 0, stop: 0 }, 'should accept a stop of 0')
	t.deepEqual(get_partstack({ stackstart: '30', stackstop: '90' }), { start: 30, stop: 90 }, 'should convert strings')
	const invalid = [
		[{ stackstart: 'abc', stackstop: 60 }, '.stackstart not integer'],
		[{ stackstart: 0, stackstop: 'abc' }, '.stackstop not integer'],
		[{ stackstart: 0.5, stackstop: 60 }, '.stackstart not integer'],
		[{ stackstart: 0, stackstop: Infinity }, '.stackstop not integer'],
		[{ stackstart: 0 }, '.stackstop missing'],
		[{ stackstop: 60 }, '.stackstart missing'],
		[{ stackstart: 60, stackstop: 0 }, '.stackstart greater than .stackstop']
	]
	for (const [query, message] of invalid) {
		let thrown
		try {
			get_partstack(query)
		} catch (e) {
			thrown = e
		}
		t.equal(thrown, message, `should throw ${message} for ${JSON.stringify(query)}`)
	}
	t.end()
})

function getStackedGroup(stackcount: number, partstack: { start: number; stop: number }) {
	const group: any = { stacks: new Array(stackcount).fill(1), partstack }
	const templates = Array.from({ length: stackcount }, (_, y) => ({ y }))
	return { group, templates }
}

tape('bam.js - may_trimstacks', t => {
	{
		const { group, templates } = getStackedGroup(100, { start: 20, stop: 80 })
		const lst = may_trimstacks(group, templates, {})
		t.equal(group.stacks.length, 61, 'should keep the stacks from start to stop')
		t.deepEqual(
			lst.map(i => i.y),
			Array.from({ length: 61 }, (_, i) => i),
			'should shift the kept templates to start from 0'
		)
	}
	{
		const { group, templates } = getStackedGroup(100, { start: 40, stop: 100 })
		const lst = may_trimstacks(group, templates, {})
		t.equal(group.stacks.length, 60, 'should end at the last existing stack')
		t.equal(lst.length, 60, 'should keep the templates up to the last existing stack')
	}
	{
		const { group, templates } = getStackedGroup(100, { start: 0, stop: 1e9 })
		may_trimstacks(group, templates, {})
		t.equal(group.stacks.length, 100, 'should not add stacks beyond the existing stack count')
	}
	{
		const { group, templates } = getStackedGroup(40, { start: -1e9, stop: 20 })
		const lst = may_trimstacks(group, templates, {})
		t.equal(group.stacks.length, 21, 'should start at the first existing stack')
		t.equal(lst[0].y, 0, 'should keep the first template at y=0')
	}
	{
		const { group, templates } = getStackedGroup(10, { start: 50, stop: 60 })
		const lst = may_trimstacks(group, templates, {})
		t.equal(group.stacks.length, 0, 'should have no stacks for a range after the last stack')
		t.equal(lst.length, 0, 'should have no templates for a range after the last stack')
	}
	t.end()
})

/*
files/hg38/bam/edge.bam has 600 unpaired reads of 100nt on chr17 from 7680001 to 7684194, one every 7 bases, and 20
reads before them from 7669950, with two pairs, see bamFile.unit.spec.ts
*/
const edgeQuery = () => ({ file: 'files/hg38/bam/edge.bam', dir: null, withoutIndex: false, nochr: false })
const lineStart = (line: string) => Number(line.split('\t')[3])

/** read_regions() with read_limits changed to limits, which are restored after it */
async function readWithLimits(limits: Partial<typeof read_limits>, regions: any[], withDepth = false) {
	const saved = { ...read_limits }
	Object.assign(read_limits, limits)
	try {
		const q: any = edgeQuery()
		await read_regions(q, regions, withDepth)
		return q
	} finally {
		Object.assign(read_limits, saved)
	}
}

tape('bam.js - read_regions: the limits of the reads', async t => {
	{
		const r = { chr: 'chr17', start: 7680001, stop: 7700000 }
		const q = await readWithLimits({}, [r])
		t.equal(r.lines.length, 600, 'should keep all the reads under the limits')
		t.notOk(q.read_stops, 'should not stop the reads under the limits')
		t.notOk(q.read_limit_reached, 'should not downsample the reads under the limits')
	}
	{
		// 100 reads of 100nt
		const r = { chr: 'chr17', start: 7680001, stop: 7700000 }
		const q = await readWithLimits({ maxscanbases: 100 * 100 }, [r], true)
		t.equal(r.lines.length, 100, 'should read the reads up to maxscanbases')
		t.deepEqual(
			r.lines.map(lineStart),
			Array.from({ length: 100 }, (_, i) => 7680001 + 7 * i),
			'should read the first reads of the region'
		)
		t.deepEqual(q.read_stops, [{ chr: 'chr17', position: 7680701 }], 'should have the start of the first read not read')
		let last = 0
		q.regionDepths.get(r).forEach((position: number) => (last = position))
		t.equal(last, 7680693 + 99, 'should have the depth of the reads that were read')
	}
	{
		const a = { chr: 'chr17', start: 7680001, stop: 7682100 },
			b = { chr: 'chr17', start: 7682101, stop: 7700000 }
		const q = await readWithLimits({ maxscanbases: 200 * 100 }, [a, b])
		t.equal(a.lines.length, 100, 'should read half of maxscanbases in the first of two regions')
		t.equal(b.lines.length, 100, 'should leave the other half of maxscanbases to the second region')
		t.equal(q.read_stops?.length, 2, 'should have the stop of each region')
	}
	{
		const r = { chr: 'chr17', start: 7680001, stop: 7700000 }
		const q = await readWithLimits({ maxrenderbases: 100 * 100 }, [r])
		t.equal(r.lines.length, 100, 'should downsample the reads to maxrenderbases')
		t.equal(q.read_limit_reached, 600, 'should have the number of reads that were read')
		t.notOk(q.read_stops, 'should not stop the reads that are downsampled under maxscanbases')
		const starts = r.lines.map(lineStart)
		t.deepEqual(
			starts,
			[...starts].sort((x, y) => x - y),
			'should keep the downsampled reads in the order of the file'
		)
		t.ok(starts.at(-1)! > 7683000, 'should downsample the reads across the region')
		const again = { chr: 'chr17', start: 7680001, stop: 7700000 }
		await readWithLimits({ maxrenderbases: 100 * 100 }, [again])
		t.deepEqual(again.lines, r.lines, 'should keep the same reads for the same request')
	}
	{
		// the reads of a pair have the same name
		const names = (r: any) => r.lines.map((l: string) => l.split('\t')[0])
		const all = { chr: 'chr17', start: 7669950, stop: 7680000 }
		await readWithLimits({}, [all])
		const count = new Map<string, number>()
		for (const n of names(all)) count.set(n, (count.get(n) || 0) + 1)
		const pairs = [...count].filter(([, n]) => n == 2).map(([name]) => name)
		t.equal(pairs.length, 2, 'should have two pairs in the region')
		let split = 0
		for (let n = 1; n < all.lines.length; n++) {
			const r = { chr: 'chr17', start: 7669950, stop: 7680000 }
			await readWithLimits({ maxrenderbases: n * 100 }, [r])
			const kept = names(r)
			for (const p of pairs) if (kept.filter((x: string) => x == p).length == 1) split++
		}
		t.equal(split, 0, 'should keep or drop the reads of a pair together')
	}
	t.end()
})
