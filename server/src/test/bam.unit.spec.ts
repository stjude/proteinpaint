/********************************************
Unit Test for parse_align_output (server/src/bam.js)
Run with:  node server/src/test/bam.unit.spec.ts
*********************************************/

import tape from 'tape'
import { parse_align_output } from '@sjcrh/proteinpaint-server/src/bam.js'

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
