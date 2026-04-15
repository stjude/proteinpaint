/********************************************
Unit Test script for 'python/src/seqMultiAlign.py'

Run test script as follows (from 'proteinpaint/'):
    node python/test/seqMultiAlign.unit.spec.js
*********************************************/

import tape from 'tape'
import { run_python } from '@sjcrh/proteinpaint-python'

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
