/********************************************
Unit Test for parse_align_output, get_partstack and may_trimstacks (server/src/bam.js)
Run with:  node server/src/test/bam.unit.spec.ts
*********************************************/

import tape from 'tape'
import { parse_align_output, get_partstack, may_trimstacks } from '../bam.js'

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
		t.throws(
			() => get_partstack(query),
			new RegExp(message.replace(/\./g, '\\.')),
			`should throw ${message} for ${JSON.stringify(query)}`
		)
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
