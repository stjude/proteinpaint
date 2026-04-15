/********************************************
Unit Test for parse_align_output (server/src/bam.js)
Run with:  node server/src/test/bam.unit.spec.ts
*********************************************/

import tape from 'tape'
import { parse_align_output, align_multiple_reads } from '@sjcrh/proteinpaint-server/src/bam.js'

// Test the input + output of parse_align_output
tape('bam.js - align_multiple_reads + parse_align_output', async t => {
	// -------------------------------------------------
	// Test 1: align_multiple_reads() → full pipeline
	// -------------------------------------------------
	tape('align_multiple_reads should generate input and return parsed alignment', async t => {
		// Sample templates (what comes from get_templates())
		const templates = [
			{
				x1: 200,
				x2: 400,
				__tempscore: ['alt0'],
				segments: [
					{
						qname: '24682252',
						segstart: 55589707,
						segstart_original: 55589707,
						segstop: 55589768,
						boxes: [
							{
								opr: 'M',
								start: 55589707,
								len: 61,
								cidx: 0
							},
							{
								opr: 'S',
								start: 55589768,
								len: 39,
								cidx: 61
							}
						],
						forward: true,
						ridx: 0,
						seq: 'TTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACAGGCTCGTGGAAGGCATGCTCCCATGTGTGGCAGG',
						qual: 'HHHHHHHHHHHHHHHHHHGHHHHHHHHHHHGHHHHHHHHHHHHHHHHHHHHFHHFHHHHHFHHHHHHFBH@#############################',
						cigarstr: '61M39S',
						tlen: 160,
						flag: '99',
						tempscore: ['alt0'],
						isfirst: true,
						x1: 200,
						x2: 400
					}
				],
				y: 0
			},
			{
				x1: 242,
				x2: 442,
				__tempscore: ['alt0'],
				segments: [
					{
						qname: '24682297',
						segstart: 55589728,
						segstart_original: 55589728,
						segstop: 55589772,
						boxes: [
							{
								opr: 'M',
								start: 55589728,
								len: 44,
								cidx: 0
							},
							{
								opr: 'S',
								start: 55589772,
								len: 56,
								cidx: 44
							}
						],
						forward: true,
						ridx: 0,
						seq: 'GCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACAGGCTCGTGAATGGCATGCTCCAAAGTGTGGCAGGAGGGTTTCCCGAGGCCCCAAA',
						qual: 'HHFHHHHHHHFHHGHGHFHHHFHHHHHHEHHHHHHHHHHHHHHHFEHGHH##################################################',
						cigarstr: '44M56S',
						tlen: 151,
						flag: '99',
						tempscore: ['alt0'],
						isfirst: true,
						x1: 242,
						x2: 442
					}
				],
				y: 1
			},
			{
				x1: 298,
				x2: 504,
				__tempscore: ['alt0'],
				segments: [
					{
						qname: '24682239',
						segstart: 55589756,
						segstart_original: 55589756,
						segstop: 55589859,
						boxes: [
							{
								opr: 'M',
								start: 55589756,
								len: 14,
								cidx: 0
							},
							{
								opr: 'D',
								start: 55589770,
								len: 3
							},
							{
								opr: 'M',
								start: 55589773,
								len: 86,
								cidx: 14
							}
						],
						forward: false,
						ridx: 0,
						seq: 'AGAAATCCTGACTTACAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAG',
						qual: 'AEAABBDEFEDFDFFE=HGHEFGEGGAGECFGGGDGGGFGEDEFEIEFDFHHHFHHFHHFHEHHHGGEGGHGGHHGGGGGEFFEFGGFEGGGGGFEGGGG',
						cigarstr: '14M3D86M',
						tlen: -133,
						flag: '147',
						tempscore: ['alt0'],
						islast: true,
						x1: 298,
						x2: 504
					}
				],
				y: 2
			},
			{
				x1: 298,
				x2: 504,
				__tempscore: ['alt0'],
				segments: [
					{
						qname: '24682424',
						segstart: 55589756,
						segstart_original: 55589756,
						segstop: 55589813,
						boxes: [
							{
								opr: 'M',
								start: 55589756,
								len: 14,
								cidx: 0
							},
							{
								opr: 'D',
								start: 55589770,
								len: 3
							},
							{
								opr: 'M',
								start: 55589773,
								len: 40,
								cidx: 14
							},
							{
								opr: 'S',
								start: 55589813,
								len: 46,
								cidx: 54
							}
						],
						forward: true,
						ridx: 0,
						seq: 'AGAAATCCTGACTTACAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGGAGGGTTCCCCGAGCCCCCAATAGATTGGGATTTTTGTCCAGGGACTGAG',
						qual: 'FFFFFFFFFFFFFFFFFFFEFF?1C6>47?3)444?=@*?############################################################',
						cigarstr: '14M3D40M46S',
						tlen: 159,
						flag: '99',
						tempscore: ['alt0'],
						isfirst: true,
						x1: 298,
						x2: 504
					}
				],
				y: 3
			},
			{
				x1: 314,
				x2: 520,
				__tempscore: ['alt0'],
				segments: [
					{
						qname: '24682252',
						segstart: 55589764,
						segstart_original: 55589764,
						segstop: 55589867,
						boxes: [
							{
								opr: 'M',
								start: 55589764,
								len: 6,
								cidx: 0
							},
							{
								opr: 'D',
								start: 55589770,
								len: 3
							},
							{
								opr: 'M',
								start: 55589773,
								len: 94,
								cidx: 6
							}
						],
						forward: false,
						ridx: 0,
						seq: 'TGACTTACAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAGCAGAGGTG',
						qual: 'EFEEED8CEGECECFHHHHHHHHHHHHHHHHHHHGHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH',
						cigarstr: '6M3D94M',
						tlen: -160,
						flag: '147',
						tempscore: ['alt0'],
						islast: true,
						x1: 314,
						x2: 520
					}
				],
				y: 4
			}
		]
		const leftflankseq_length = 101
		const partstack_start = 0
		const partstack_stop = 0
		const reference_sequence =
			'AGGGATTAGAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAGCAGAGGTGAGATGATT'

		try {
			const result = await align_multiple_reads(
				templates,
				leftflankseq_length,
				partstack_start,
				partstack_stop,
				reference_sequence
			)

			t.ok(result, 'Should return result object')
			t.ok(Array.isArray(result.final_read_align), 'Should have final_read_align')
			t.ok(Array.isArray(result.qual_r), 'Should have qual_r')
			t.equal(result.final_read_align.length, 6, 'Should have 6 aligned reads (excluding reference)')
		} catch (err) {
			console.error('Error in align_multiple_reads:', err)
			t.fail(`align_multiple_reads failed: ${err.message}`)
		}

		t.end()
	})
})
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
