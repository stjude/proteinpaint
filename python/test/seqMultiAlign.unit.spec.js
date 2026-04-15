/********************************************
Unit Test script for 'python/src/seqMultiAlign.py'

Run test script as follows (from 'proteinpaint/'):
    node python/test/seqMultiAlign.unit.spec.js
*********************************************/

import tape from 'tape'
import { run_python } from '@sjcrh/proteinpaint-python'
import { parse_align_output } from '@sjcrh/proteinpaint-server/src/bam.js'

tape('Test MSA #0: Basic functionality with 4 sequences', async t => {
	const fasta = `>seq1
ATGCTACGATCGATCGTACGATCG
>seq2
ATGCTACGATCGAT-GTACGATCG
>seq3
ATGCTACGATCGA--GTACGATCG
>seq4
ATGCTACGATCGATCGTACGATCA
`
	const input = {
		fasta_sequence: fasta,
		max_read_alignment: 10
	}

	try {
		const output = await run_python('seqMultiAlign.py', JSON.stringify(input))

		t.ok(output.includes('Multiple Sequencing Alignment'), 'Should contain header')
		t.ok(output.includes('seq1'), 'Should contain sequence ID seq1')
		t.ok(output.includes('*'), 'Should contain conservation line with *')
	} catch (err) {
		t.fail(`Basic MSA test failed: ${String(err)}`)
	}
	t.end()
})

tape('Test MSA #2: Respect max_read_alignment limit', async t => {
	const fasta = `>s1\nATGC\n>s2\nATGC\n>s3\nATGC\n>s4\nATGC\n>s5\nATGC\n>s6\nATGC`

	const input = {
		fasta_sequence: fasta,
		max_read_alignment: 3
	}

	try {
		const output = await run_python('seqMultiAlign.py', JSON.stringify(input))
		const count = (output.match(/s\d/g) || []).length
		t.ok(count <= 4, `Should limit to ${input.max_read_alignment + 1} sequences (found ${count})`)
	} catch (err) {
		t.fail(`Max limit test failed: ${String(err)}`)
	}
	t.end()
})

tape('Test MSA #3: parse_align_output', async t => {
	// Sample with 4 sequences (more than 2)
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
		t.ok(typeof result, 'object', 'Result should be an object')

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
	} catch (err) {
		t.fail(`Failed to parse the output of alignment: ${err.message}`)
	}
	t.end()
})
