// Import necessary modules
import { run_rust } from '@sjcrh/proteinpaint-rust'
import tape from 'tape'
import additionalExamples from './indel.examples.js'
// import utils from '@sjcrh/proteinpaint-utils'

/*
to compile rust, see server/utils/rust/README.md
Syntax for compiling the rust code: cd ~/proteinpaint/server/utils/rust && cargo build --release

run as: $ node indel.unit.spec.js

"examples[]" array structure
[
	{
	pplink: <provide the pplink of this example for manual inspection>
	leftFlank
	rightFlank
	seqRef <reference seq>
	seqMut <mutated seq>
	variant {
		pos <0-based!!!>
		ref
		alt
	}
	reads [
		{
			n <str, optional comment on what this read is about>
			s <str, read sequence>
			p <int, 1-based alignment position from BAM file>
			c <str, cigar>
			f <int, flag>
			g <str, one string from groupkeys[]>
                        g_0 <str, one string from groupkeys[] for strictness = 0 (is optional and used when different strictness values yield different results for that read)>
		}
	]
	}
]

to add a new test example:
- first obtain the bam slice file on your computer and the browser url for it
- uncomment console.log() line at 160 of bam.kmer.indel.js
- run the example from browser, use server log to create a new object in examples[] array
- to add individual reads of this example:
  - click on a representative read and show the read panel
  - from the panel, copy read sequence, start position, cigar, flag
    to construct the object {n,s,p,c,f,g}
	enter appropriate group (ref/alt/none/amb)
	and add optional note (e.g. "softclip on left")

if indel binary input format is changed, update code to assemble the input string
if output format is changed (expecting below output), update code:

Number of reads analyzed: 8
alternate_forward_count:6
alternate_reverse_count:0
reference_forward_count:1
reference_reverse_count:0
strand_probability:-0.00
output_cat:"ref:none:alt:alt:alt:alt:alt:alt"
output_gID:"6:7:0:1:2:3:4:5"
output_diff_scores:"-0.1537931034482759:-0.01869158878504673:0.02717086834733884:0.027087378640776705:0.02656130997715156:0.027378640776698937:0.029126213592232997:0.029126213592232997"
***************/

const pphost = 'http://pp-int-test.stjude.org/' // show links using this host

/**************
 Test sections
***************/
tape('\n', function (test) {
	test.comment('-***- rust indel specs -***-')
	test.end()
})

tape('rust indel binary', async function (test) {
	const strictness_values = [0, 1] // Array containing the possible number of strictness values. This array structure is better than hardcoding, because number of strictness values may change later.
	for (const strictness of strictness_values) {
		console.log('Testing with strictness=', strictness)
		for (const e of examples) {
			try {
				await runTest(e, test, strictness)
			} catch (err) {
				test.fail('unexpected test error? ' + err)
			}
		}
	}
	test.end()
})

async function runTest(e, test, strictness) {
	// validate data structure of e
	if (!e.pplink) throw '.pplink missing'
	test.pass(`Testing "${e.comment}" at ${e.pplink}`)

	if (!e.leftFlank) throw '.leftFlank missing'
	if (!e.rightFlank) throw '.rightFlank missing'
	if (!e.seqRef) throw '.seqRef missing'
	if (!e.seqMut) throw '.seqMut missing'
	if (!e.variant) throw '.variant{} missing'
	if (!Number.isInteger(e.variant.pos)) throw '.variant.pos is not integer'
	if (!e.variant.ref) throw '.variant.ref missing'
	if (!e.variant.alt) throw '.variant.alt missing'
	if (!Array.isArray(e.reads)) throw '.reads[] missing'
	if (e.reads.length == 0) throw '.reads[] empty array'

	const alleles = [
		// For now hardcoding for single allele
		{
			ref_position: e.variant.pos,
			refallele: e.variant.ref,
			altallele: e.variant.alt,
			refseq: e.seqRef,
			altseq: e.seqMut,
			leftflankseq: e.leftFlank,
			rightflankseq: e.rightFlank
		}
	]

	let groupkeys = ['ref', 'none', 'amb'] // corresponds to the same values returned by rust
	for (let var_idx = 0; var_idx < alleles.length; var_idx++) {
		groupkeys.push('alt' + var_idx.toString())
	}

	const reads = []
	for (const r of e.reads) {
		if (!r.s) throw '.s (sequence) missing from a read'
		if (!Number.isInteger(r.p)) throw '.p (position) not integer from a read'
		if (!r.c) throw '.c (cigar) missing from a read'
		if (!groupkeys.includes(r.g)) throw '.g (group) is invalid for a read'
		if (!Number.isInteger(r.f)) throw '.f (flag) not integer for a read'
		reads.push({ read_sequence: r.s, start_position: Number(r.p), cigar: r.c, flag: r.f })
	}

	const input_data = { reads: reads, alleles: alleles, strictness: Number(strictness) }

	const rust_output = await run_rust('indel', JSON.stringify(input_data))
	const rust_output_list = rust_output.split('\n')

	// Define final_output variable before using it
	let final_output = null

	for (let item of rust_output_list) {
		if (item.includes('Final_output:')) {
			final_output = JSON.parse(JSON.parse(item.replace('Final_output:', '')))
		}
	}

	// Check if final_output was set
	if (!final_output) {
		test.fail('Could not find Final_output in the rust output')
		return
	}

	test.equal(final_output.length, e.reads.length, 'indices.length should equal final_output.length')

	const results = [] // in the same order as e.reads[]
	for (let i = 0; i < final_output.length; i++) {
		results[final_output[i].read_number] = final_output[i].categories[0] // The first element of categories contains the read classification
	}
	// find reads with wrong classification
	let wrongcount = 0
	for (let i = 0; i < results.length; i++) {
		if (strictness == 0) {
			// Check if "g_0" exists for that read
			if (e.reads[i].g_0) {
				// if it exists check with truth value for strictness = 0
				if (e.reads[i].g_0 != results[i]) wrongcount++
			} else {
				// if g_0 does not exist for that read use the truth value for strictness = 1
				if (e.reads[i].g != results[i]) wrongcount++
			}
		} else if (e.reads[i].g != results[i]) wrongcount++ // For strictness = 1, simply check truth value for strictness = 1, i.e. .g
	}
	if (wrongcount) {
		const lst = []
		for (let i = 0; i < e.reads.length; i++) {
			let truth
			if (strictness == 0) {
				if (e.reads[i].g_0) {
					// if it exists check with truth value for strictness = 0
					truth = e.reads[i].g_0
				} else {
					// if g_0 does not exist for that read use the truth value for strictness = 1
					truth = e.reads[i].g
				}
			} else {
				truth = e.reads[i].g
			}
			const result = results[i]
			lst.push(
				i + '\t\t' + truth + '\t' + (truth != result ? result + (e.reads[i].n ? ' (' + e.reads[i].n + ')' : '') : '')
			)
		}
		test.fail(`Misassigned ${wrongcount} reads:\nRead\tTruth\tResult\n${lst.join('\n')}`)
	} else {
		test.pass('classifications are correct')
	}
}
const examples = [
	// one object for each example

	// additional examples from separate script
	...additionalExamples,

	{
		comment: '8-bp insertion at CBL exon 10',
		pplink:
			pphost +
			'?genome=hg19&block=1&bamfile=test,proteinpaint_demo/hg19/bam/rna.8bp.insertion.bam&position=chr11:119155611-119155851&variant=chr11.119155746.T.TTGACCTGG',
		leftFlank: 'GTACCCTAGGTGGAACGGCCGCCTTCTCCATTCTCCATGGCCCCACAAGCTTCCCTTCCCCCGGTGCCACCACGAC',
		rightFlank: 'TGACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAGTGCTTCTGCTCTTGGAACTGCTTCTAAGGTAAAGCATTTT',
		seqRef:
			'GTACCCTAGGTGGAACGGCCGCCTTCTCCATTCTCCATGGCCCCACAAGCTTCCCTTCCCCCGGTGCCACCACGACTTGACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAGTGCTTCTGCTCTTGGAACTGCTTCTAAGGTAAAGCATTTT',
		seqMut:
			'GTACCCTAGGTGGAACGGCCGCCTTCTCCATTCTCCATGGCCCCACAAGCTTCCCTTCCCCCGGTGCCACCACGACTTGACCTGGTGACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAGTGCTTCTGCTCTTGGAACTGCTTCTAAGGTAAAGCATTTT',
		variant: {
			pos: 119155745, // 0-based
			ref: 'T',
			alt: 'TTGACCTGG'
		},
		reads: [
			{
				n: 'mismatch on right',
				s: 'CGGCCGCCTTCTCCATTCTCCATGGCCCCACAAGCTTCCCTTCCCCCGGTGCCACCACGACTTGACCTGGTGACC',
				p: 119155685,
				c: '75M',
				f: 163,
				g: 'alt0'
			},
			{
				n: 'softclip on right',
				s: 'CTTCTCCATTCTCCATGGCCCCACAAGCTTCCCTTCCCCCGGTGCCACCACGACTTGACCTGGTGACCTTCTGCC',
				p: 119155692,
				c: '61M14S',
				f: 163,
				g: 'alt0'
			},
			{
				n: 'insertion at right',
				s: 'TCCATTCTCCATGGCCCCACAAGCTTCCCTTCCCCCGGTGCCACCACGACTTGACCTGGTGACCTTCTGCCGCAG',
				p: 119155696,
				c: '51M8I16M',
				f: 83,
				g: 'alt0'
			},
			{
				n: 'insertion at left',
				s: 'AAGCTTCCCTTCCCCCGGTGCCACCACGACTTGACCTGGTGACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAG',
				p: 119155716,
				c: '37M8I30M',
				f: 163,
				g: 'alt0'
			},
			{
				n: 'softclip on left',
				s: 'CCACGACTTGACCTGGTGACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAGTGCTTCTGCTCTTGGAACTGCTT',
				p: 119155731,
				c: '16S59M',
				f: 163,
				g: 'alt0'
			},
			{
				n: 'softclip on left',
				s: 'CTTGACCTGGTGACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAGTGCTTCTGCTCTTGGAACTGCTTCTAAGG',
				p: 119155737,
				c: '10S65M',
				f: 163,
				g: 'alt0'
			},
			{
				n: 'only one read is ref',
				s: 'CTTCTCCATTCTCCATGGCCCCACAAGCTTCCCTTCCCCCGGTGCCACTACGACTTGACCTTCTGCCGCAGCGAG',
				p: 119155692,
				c: '75M',
				f: 163,
				g: 'ref'
			},
			{
				n: 'none read with 8 insertion',
				s: 'GCCACCACGACTTGACCTGGCGACCTTCTGCCGCAGCGAGTATGCGTTCCCTCAAGTGCTTCTGCTCTTGGAACT',
				p: 119155735,
				c: '18M8I49M',
				f: 163,
				g: 'none',
				g_0: 'alt0'
			},
			{
				s: 'ACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAGTGCTTCTGCTCTTGGAACTGCTTCTAAGGCTGCTTCTGGCT',
				p: 119155749,
				c: '62M88N13M',
				f: 163,
				g: 'amb'
			}
		]
	},
	{
		comment: '3-bp deletion in KIT exon 8',
		pplink:
			pphost +
			'?genome=hg19&block=1&position=chr4:55589607-55590007&bamfile=Test,proteinpaint_demo/hg19/bam/kit.exon8.del.bam&variant=chr4.55589771.ACGA.A',
		leftFlank: 'AGGGATTAGAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTT',
		rightFlank: 'CAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAGCAGAGGTGAGATGATT',
		seqRef:
			'AGGGATTAGAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACGACAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAGCAGAGGTGAGATGATT',
		seqMut:
			'AGGGATTAGAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAGCAGAGGTGAGATGATT',
		variant: {
			pos: 55589770,
			ref: 'ACGA',
			alt: 'A'
		},
		reads: [
			{
				n: 'with softclip',
				s: 'TTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACAGGCTCGTGGAAGGCATGCTCCCATGTGTGGCAGG',
				p: 55589708,
				c: '61M39S',
				f: 99,
				g: 'alt0'
			},
			{
				n: 'with softclip',
				s: 'GCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACAGGCTCGTGAATGGCATGCTCCAAAGTGTGGCAGGAGGGTTTCCCGAGGCCCCAAA',
				p: 55589729,
				c: '44M56S',
				f: 99,
				g: 'alt0'
			},
			{
				n: 'with del',
				s: 'AGAAATCCTGACTTACAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGGAGGGTTCCCCGAGCCCCCAATAGATTGGGATTTTTGTCCAGGGACTGAG',
				p: 55589757,
				c: '14M3D40M46S',
				f: 99,
				g: 'alt0'
			},
			{
				n: 'distal SNV',
				s: 'GGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCGGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACGACAGGCTCG',
				p: 55589683,
				c: '100M',
				f: 83,
				g: 'ref'
			},
			{
				n: 'SNV at first bp of deletion site',
				s: 'CACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTGCGACAGGCTCGTGAATGGCATGCTCCCATGTGTGGCCGCAGGG',
				p: 55589715,
				c: '100M',
				f: 99,
				g: 'none',
				g_0: 'ref'
			},
			{
				s: 'GATTAGAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTAC',
				p: 55589673,
				c: '100M',
				f: 99,
				g: 'amb'
			}
		]
	},
	{
		comment: '19bp deletion at TP53',
		pplink:
			pphost +
			'?genome=hg19&block=1&bamfile=TP53_del,rpaul1/kmers/SJHGG010324_A3.bam&position=chr17:7578371-7578417&variant=chr17.7578383.AGCAGCGCTCATGGTGGGG.A&bedjfilterbyname=NM_000546',
		leftFlank:
			'CAAATACTCCACACGCAAATTTCCTTCCACTCGGATAAGATGCTGAGGAGGGGCCAGACCTAAGAGCAATCAGTGAGGAATCAGAGGCCTGGGGACCCTGGGCAACCAGCCCTGTCGTCTCTCCAGCCCCAGCTGCTCACCATCGCTATCTG',
		rightFlank:
			'GCAGCGCCTCACAACCTCCGTCATGTGCTGTGACTGCTTGTAGATGGCCATGGCGCGGACGCGGGTGCCGGGCGGGGGTGTGGAATCAACCCACAGCTGCACAGGGCAGGTCTTGGCCAGTTGGCAAAACATCTTGTTGAGGGCAGGGGAGT',
		seqRef:
			'CAAATACTCCACACGCAAATTTCCTTCCACTCGGATAAGATGCTGAGGAGGGGCCAGACCTAAGAGCAATCAGTGAGGAATCAGAGGCCTGGGGACCCTGGGCAACCAGCCCTGTCGTCTCTCCAGCCCCAGCTGCTCACCATCGCTATCTGAGCAGCGCTCATGGTGGGGGCAGCGCCTCACAACCTCCGTCATGTGCTGTGACTGCTTGTAGATGGCCATGGCGCGGACGCGGGTGCCGGGCGGGGGTGTGGAATCAACCCACAGCTGCACAGGGCAGGTCTTGGCCAGTTGGCAAAACATCTTGTTGAGGGCAGGGGAGT',
		seqMut:
			'CAAATACTCCACACGCAAATTTCCTTCCACTCGGATAAGATGCTGAGGAGGGGCCAGACCTAAGAGCAATCAGTGAGGAATCAGAGGCCTGGGGACCCTGGGCAACCAGCCCTGTCGTCTCTCCAGCCCCAGCTGCTCACCATCGCTATCTGAGCAGCGCCTCACAACCTCCGTCATGTGCTGTGACTGCTTGTAGATGGCCATGGCGCGGACGCGGGTGCCGGGCGGGGGTGTGGAATCAACCCACAGCTGCACAGGGCAGGTCTTGGCCAGTTGGCAAAACATCTTGTTGAGGGCAGGGGAGT',
		variant: {
			pos: 7578382, // 0-based
			ref: 'AGCAGCGCTCATGGTGGGG',
			alt: 'A'
		},
		reads: [
			{
				n: 'mismatch and insertion on right',
				s: 'CAAATTTCCTTCCACTCGGATAAGATGCTGAGGAGGGGCCAGACCTAAGAGCAATCAGTGAGGAATCAGAGGCCTGGGGACCCTGGGCAACCAGCCCTGTCGTCTCTCCAGCCCCAGCTGCTCACCATCGCTATCTGAGCAGCGCCTCACA',
				p: 7578246,
				c: '144M1I6M',
				f: 99,
				g: 'alt0'
			},
			{
				n: 'mismatch on right',
				s: 'ACGCAAATTTCCTTCCACTCGGATAAGATGCTGAGGAGGGGCCAGACCTAAGAGCAATCAGTGAGGAATCAGAGGCCTGGGGACCCTGGGCCACCAGCCCTGTCGTCTCTCCAGCCCCAGCTGCTCACCATCGCTATCTGAGCAGCGCCTC',
				p: 7578243,
				c: '151M',
				f: 163,
				g: 'alt0'
			},
			{
				n: 'Softclip on right',
				s: 'TTCCACTCGGATAAGATGCTGAGGAGGGGCCAGACCTAAGAGCAATCAGTGAGGAATCAGAGGCCTGGGGACCCTGGGCAACCAGCCCTGTCGTCTCTCCAGCCCCAGCTGCTCACCATCGCTATCTGAGCAGCGCCTCACAACCTCCGTC',
				p: 7578255,
				c: '136M15S',
				f: 99,
				g: 'alt0'
			},
			{
				n: 'Insertion only on right',
				s: 'CGCAAATTTCCTTCCACTCGGATAAGATGCTGAGGAGGGGCCAGACCTAAGAGCAATCAGTGAGGAATCAGAGGCCTGGGGACCCTGGGCAACCAGCCCTGTCGTCTCTCCAGCCCCAGCTGCTCACCATCGCTATCTGAGCAGCGCCTCA',
				p: 7578244,
				c: '146M1I14M',
				f: 83,
				g: 'alt0'
			},
			{
				n: 'Deletion in middle of read',
				s: 'TAAGATGCTGAGGAGGGGCCAGACCTAAGAGCAATCAGTGAGGAATCAGAGGCCTGGGGACCCTGGGCAACCAGCCCTGTCGTCTCTCCAGCCCCAGCTGCTCACCATCGCTATCTGAGCAGCGCCTCACAACCTCCGTCATGTGCTGTGA',
				p: 7578266,
				c: '118M18D33M',
				f: 99,
				g: 'alt0'
			},
			{
				n: 'Softclip on left',
				s: 'TGCTCACCATCGCTATCTGAGCAGCGCCTCACAACCTCCGTCATGTGCTGTGACTGCTTGTAGATGGCCATGGCGCGGACGCGGGTGCCGGGCGGGGGTGTGGAATCAACCCACAGCTGCACAGGGCAGGTCTTGGCCAGTTGGCAAAACA',
				p: 7578382,
				c: '20S131M',
				f: 147,
				g: 'alt0'
			},
			{
				n: 'Mismatch on left',
				s: 'CTATCTGAGCAGCGCCTCACAACCTCCGTCATGTGCTGTGACTGCTTGTAGATGGCCATGGCGCGGACGCGGGTGCCGGGCGGGGGTGTGGAATCAACCCACAGCTGCACAGGGCAGGTCTTGGCCAGTTGGCAAAACATCTTGTTGAGGG',
				p: 7578394,
				c: '151M',
				f: 147,
				g: 'alt0'
			},
			{
				n: 'Deletion (supporting alt) with mismatch, different strictness values gives different results',
				s: 'GAATCAGAGGCCTGGGGACCCTGGGCAACCAGCCCTGTCGTCTCTCCAGCCCCAGCTGCTCACCATCGCTATCTGCGCAGCGCCTCACACCCTCCGTCATGTGCTGTGACTGCTTGTAGATGGCCATGGCGCGGACGCGGGTGCCGGGCGG',
				p: 7578308,
				c: '74M18D77M',
				f: 163,
				g: 'none',
				g_0: 'alt0' // Value for strictness = 0
			},
			{
				n: 'Read supporting reference but with mismatch at variant region, different strictness values gives different results',
				s: 'GGGCAACCAGCCCTGTCGTCTCTCCAGCCCCAGCTGCTCACCATCGCTATCTGAGCAGCGCCCATGGTGGGGGCGGCGCCTCACAACCTCCGTCATGTGCTGTGACTGCTTGTAGATGGCCATGGCGCGGACGCGCGTGCCGGGCGGGGGT',
				p: 7578330,
				c: '151M',
				f: 83,
				g: 'none',
				g_0: 'ref' // Value for strictness = 0
			},
			{
				n: 'Read supporting reference but mismatch is outside variant, both strictness values should yield same result',
				s: 'GGGCAACCAGCCCTGTCGTCTCTCCAGCCCCAGCTGCTCACCATCGCTATCTGAGCAGCGCTCATGGTGGGGGCGGCGCCTCACAACCTCCGTCATGTGCTGTGACTGCTTGTAGATGGCCATGGCGCGGACGCGGGTGCCGGGCGGGGGT',
				p: 7578330,
				c: '151M',
				f: 83,
				g: 'ref'
			}
		]
	},
	{
		comment: 'Complex indel in GATA3',
		pplink:
			pphost +
			'?genome=hg19&block=1&bamfile=MSK-VB-0001_cf_raw_sort_GATA3_indel,rpaul1/kmers/MSK-VB-0001_cf_raw_sort_GATA3_indel.bam&position=chr10:8100668-8100707&variant=chr10.8100686.CAC.CCCTGCCTGTTGTGAGCTGCTCTACGTGCCCTACGTGCT',
		leftFlank:
			'GCCGGCTCGGCCCGGCAGGACGAGAAAGAGTGCCTCAAGTACCAGGTGCCCCTGCCCGACAGCATGAAGCTGGAGTCGTCCCACTCCCGTGGCAGCATGACCGCCCTGGGTGGAGCCTCCTCGTCGACCCACCACCCCATCAC',
		rightFlank:
			'CTACCCGCCCTACGTGCCCGAGTACAGCTCCGGACTCTTCCCCCCCAGCAGCCTGCTGGGCGGCTCCCCCACCGGCTTCGGATGCAAGTCCAGGCCCAAGGCCCGGTCCAGCACAGGTAGGAGCCAGCTCTTCCCTGGAGCCT',
		seqRef:
			'GCCGGCTCGGCCCGGCAGGACGAGAAAGAGTGCCTCAAGTACCAGGTGCCCCTGCCCGACAGCATGAAGCTGGAGTCGTCCCACTCCCGTGGCAGCATGACCGCCCTGGGTGGAGCCTCCTCGTCGACCCACCACCCCATCACCACCTACCCGCCCTACGTGCCCGAGTACAGCTCCGGACTCTTCCCCCCCAGCAGCCTGCTGGGCGGCTCCCCCACCGGCTTCGGATGCAAGTCCAGGCCCAAGGCCCGGTCCAGCACAGGTAGGAGCCAGCTCTTCCCTGGAGCCT',
		seqMut:
			'GCCGGCTCGGCCCGGCAGGACGAGAAAGAGTGCCTCAAGTACCAGGTGCCCCTGCCCGACAGCATGAAGCTGGAGTCGTCCCACTCCCGTGGCAGCATGACCGCCCTGGGTGGAGCCTCCTCGTCGACCCACCACCCCATCACCCCTGCCTGTTGTGAGCTGCTCTACGTGCCCTACGTGCTCTACCCGCCCTACGTGCCCGAGTACAGCTCCGGACTCTTCCCCCCCAGCAGCCTGCTGGGCGGCTCCCCCACCGGCTTCGGATGCAAGTCCAGGCCCAAGGCCCGGTCCAGCACAGGTAGGAGCCAGCTCTTCCCTGGAGCCT',
		variant: {
			pos: 8100684, // 0-based
			ref: 'CAC',
			alt: 'CCCTGCCTGTTGTGAGCTGCTCTACGTGCCCTACGTGCT'
		},
		reads: [
			{
				n: 'softclip on right',
				s: 'GAGTGCCTCAAGTACCAGGTGCCCCTGCCCGACAGCATGAAGCTGGAGTCGTCCCACTCCCGTGGCAGCATGACCGCCCTGGGTGGAGCCTCCTCGTCGACCCACCACCCCATCACCCCTGCCTGTTGTGAGCTGCTCTACG',
				p: 8100570,
				c: '117M25S',
				f: 147,
				g: 'alt0'
			},
			{
				n: 'read supporting alt but wrong bp in alternate allele',
				s: 'CGCTGGCGTCGCCCCACTCCCGTGGCAGCATGACCGCCCTAGGTGGAGCCTCCTCGTCGACCCGCCGCCCCATCGCCCCTGCCTGTTGTGAGCTGCTCGACGTGCCCTACGTGCTCTACCCGCCCTACGTGCCCGAGTACAG',
				p: 8100610,
				c: '74M68S',
				f: 147,
				g: 'none',
				g_0: 'alt0'
			},
			{
				n: 'read supporting ref allele',
				s: 'CGTCCCACTCCCGCGGCAGCATGACCGCCCTGGGTGGAGCCTCCTCGTCGACCCACCACCCCATCACCACCTACCCGCCCTACGTGCCCGAGTACAGCTCCGGACTCTTCCCCCCCAGCAGCCTGCTGGGCGGACGCCCCAC',
				p: 8100619,
				c: '133M9S',
				f: 163,
				g: 'ref'
			},
			{
				n: 'Read supporting ref allele but has wrong bp in variant region',
				s: 'ATGGAGCTGGAGTCCTCCCCCTCCCGCGGCAGCCTGACCGCCCTGGGTGGGGCCCCCTCGGCGACCCCCCCCCCCCTCCCCCCCCACCCGCCCTACGTGCCCGGGTACAGCCCCCGGCTCTTCCCCCCCCAGCAGCCTGCTG',
				p: 8100606,
				c: '122M1I19M',
				f: 83,
				g: 'none',
				g_0: 'ref'
			}
		]
	},
	{
		comment: 'transcriptomic example with spliced reads on both sides of the variant',
		pplink:
			pphost +
			'?genome=hg19&block=1&position=chr1:62907850-62907980&hlregion=chr1:62907931-62907931&bamfile=SJGIST030018_D1,rpaul1/proteinpaint_demo/indel/BX03UJ250B.bam&variant=chr1.62907932.AAAG.A',
		leftFlank: 'TTCAGTAAACACTTAAGACAATCTCACTTTTTATAGGTATTATATTTTTGTCCCGGTTTTAAATCTGGAGTAAAGCACTTATTTAATATTATTTCAAGGAAG',
		rightFlank:
			'AAGCTCTAAAGGATGAAGCCAATCAAAAAGACAAGGTAAGAAAAATAAAGAACAGAAAATAATGTAAAAAGCAAAAGTAAATTAATGGAAATTTACTTGCCT',
		seqRef:
			'TTCAGTAAACACTTAAGACAATCTCACTTTTTATAGGTATTATATTTTTGTCCCGGTTTTAAATCTGGAGTAAAGCACTTATTTAATATTATTTCAAGGAAGAAAGAAGCTCTAAAGGATGAAGCCAATCAAAAAGACAAGGTAAGAAAAATAAAGAACAGAAAATAATGTAAAAAGCAAAAGTAAATTAATGGAAATTTACTTGCCT',
		seqMut:
			'TTCAGTAAACACTTAAGACAATCTCACTTTTTATAGGTATTATATTTTTGTCCCGGTTTTAAATCTGGAGTAAAGCACTTATTTAATATTATTTCAAGGAAGAAAGCTCTAAAGGATGAAGCCAATCAAAAAGACAAGGTAAGAAAAATAAAGAACAGAAAATAATGTAAAAAGCAAAAGTAAATTAATGGAAATTTACTTGCCT',
		variant: {
			pos: 62907931, // 0-based
			ref: 'AAAG',
			alt: 'A'
		},
		reads: [
			{
				n: 'splicing on left side of the read, variant on right fragment',
				s: 'CTTAATAGTATACTTCAGGTATTATATTTTTGTCCCGGTTTTAAATCTGGAGTAAAGCACTTATTTAATATTATTTCAAGGAAGAAAGCTCTAAAGGATGA',
				p: 62907262,
				c: '18M586N67M3D16M',
				f: 163,
				g: 'alt0'
			},
			{
				n: 'read not spliced but should be spliced on the left side but is instead softclipped',
				s: 'CTCTTCCGATCTGTATACTTCAGGTATTATATTTTTGTCCCGGTTTTAAATCTGGAGTAAAGCACTTATTTAATATTATTTCAAGGAAGAAAGCTCTAAAG',
				p: 62907864, // In the bam track read info panel the start position is misleading as the number of softclipped nucleotides is subtracted from the original position reported in the bam file
				c: '21S72M3D8M',
				f: 83,
				g: 'alt0'
			},
			{
				n: 'normal read with alt allele and no splicing',
				s: 'TATTATATTTTTGTCCCGGTTTTAAATCTGGAGTAAAGCACTTATTTAATATTATTTCAAGGAAGAAAGCTCTAAAGGATGAAGCCAATCAAAAAGACAAG',
				p: 62907867,
				c: '66M3D35M',
				f: 83,
				g: 'alt0'
			},
			{
				n: 'splicing on right side of the read, variant on left fragment',
				s: 'AAAGCACTTATTTAATATTATTTCAAGGAAGAAAGCTCTAAAGGATGAAGCCAATCAAAAAGACAAGGGAAATTGCAAAGAAGATTCTTTGGCAAGTTATG',
				p: 62907901,
				c: '32M3D35M859N34M',
				f: 163,
				g: 'alt0'
			},
			{
				n: 'read is softclipped on the left',
				s: 'CCGATCTAAAGCTCTAAAGGATGAAGCCAATCAAAAAGACAAGGGAAATTGCAAAGAAGATTCTTTGGCAAGTTATGAATTGATATGCAGTTTACAGTCCG',
				p: 62907936,
				c: '8S35M859N57M1S',
				f: 83,
				g: 'alt0'
			},
			{
				n: 'read softclipped on left but supports reference allele',
				s: 'CGTGTGCTCTTCCGATCTGTTTTAAATCTGGAGTAAAGCACTTATTTAATATTATTTCAAGGAAGAAAGAAGCTCTAAAGGATGAAGCCAATCAAAAAGAC',
				p: 62907885,
				c: '18S83M',
				f: 83,
				g: 'ref'
			}
		]
	},
	{
		comment: 'Insertion in a region which contains the same sequence in the right flanking sequence',
		pplink:
			pphost +
			'?genome=hg38&block=1&bamfile=NPM1,rpaul1/kmers/NPM1.bam&position=chr5:171410519-171410549&variant=chr5.171410539.C.CTCTG',
		leftFlank: 'ATGTTGAACTATGCAAAGAGACATTTAATTTATTGATGTCTATGAAGTGTTGTGGTTCCTTAACCACATTTCTTTTTTTTTTTTTCCAGGCTATTCAAGAT',
		rightFlank: 'TCTGGCAGTGGAGGAAGTCTCTTTAAGAAAATAGTTTAAACAATTTGTTAAAAAATTTTCCGTCTTATTTCATTTCTGTAACAGTTGATATCTGGCTGTCC',
		seqRef:
			'ATGTTGAACTATGCAAAGAGACATTTAATTTATTGATGTCTATGAAGTGTTGTGGTTCCTTAACCACATTTCTTTTTTTTTTTTTCCAGGCTATTCAAGATCTCTGGCAGTGGAGGAAGTCTCTTTAAGAAAATAGTTTAAACAATTTGTTAAAAAATTTTCCGTCTTATTTCATTTCTGTAACAGTTGATATCTGGCTGTCC',
		seqMut:
			'ATGTTGAACTATGCAAAGAGACATTTAATTTATTGATGTCTATGAAGTGTTGTGGTTCCTTAACCACATTTCTTTTTTTTTTTTTCCAGGCTATTCAAGATCTCTGTCTGGCAGTGGAGGAAGTCTCTTTAAGAAAATAGTTTAAACAATTTGTTAAAAAATTTTCCGTCTTATTTCATTTCTGTAACAGTTGATATCTGGCTGTCC',
		variant: {
			pos: 171410538, // 0-based
			ref: 'C',
			alt: 'CTCTG'
		},
		reads: [
			{
				n: 'Read supports alt allele and softclipped on right',
				s: 'ATGCAAAGAGACATTTAATTTATTGATGTCTATGAAGTGTTGTGGTTCCTTAACCACATTTCTTTTTTTTTTTTTCCAGGCTATTCAAGATCTCTGTCTG',
				p: 171410448,
				c: '96M4S',
				f: 163,
				g: 'alt0'
			},
			{
				n: 'Insertion in middle of read but wrong bp nucleotide away from variant region',
				s: 'GGGTTCCTTAACCACATTTTTTTTTTTTTTTTTCCAGGCTATTCAAGATCTCTGTCTGGTAGTGGAGGAAGTCTCTTTAAGAAAATAGTTTAAACAATTT',
				p: 171410490,
				c: '50M4I46M',
				f: 147,
				g: 'alt0'
			},
			{
				n: 'Read supports alt allele and softclipped to the left',
				s: 'CTCTGTCTGGCAGTGGAGGAAGTCTCTTTAAGAAAATAGTTTAAACAATTTGTTAAAAAATTTTCCGTCTTATTTCATTTCTGTAACAGTTGATATCTGG',
				p: 171410540,
				c: '5S95M',
				f: 83,
				g: 'alt0'
			},
			{
				n: 'Read supporting reference allele',
				s: 'ATTTAATTTTTTGATTGTTATGAAGTTTTTTGGTTCCTTTAACCCATTTTTTTTTTTTTTTTTCCAGGCTATTCAAGATCTCTGGCAGTGGAGGAAGTCT',
				p: 171410460,
				c: '100M',
				f: 147,
				g: 'ref'
			},
			{
				n: 'Read supporting alt allele but contains wrong bp inside variant region',
				s: 'TGATGTCTATGAAGTGTTGTGGTTCCTTAACCACATTTCTTTTTTTTTTTTTCCAGGCTATTCAAGATCTTTGTCTGGCAGTGGAGGAAGTCTCTTTAAG',
				p: 171410471,
				c: '69M4I27M',
				f: 97,
				g: 'none',
				g_0: 'alt0'
			},
			{
				n: 'Read supporting alternate allele but contains a mismatch in the flanking region similar to insertion',
				s: 'GTTGTGGTTCCTTAACCACATTTCTTTTTTTTTTTTTCCAGGCTATTCAAGATCTCTGGCTGGCAGTGGAGGAAGTCTCTTTAAGAAAATAGTTTAAACA',
				p: 171410486,
				c: '55M4I41M',
				f: 147,
				g: 'none',
				g_0: 'alt0'
			},
			{
				n: 'Read finishes near the adjoining region of the flanking region of the insertion which has the same sequence as the insertion itself, read is also hard-clipped at the end',
				s: 'CCACATTTGTTTTTTTTTTTTTCCCGGCCATTCAAGATCTCTG',
				p: 171410501,
				c: '50H43M7H',
				f: 2209,
				g: 'amb'
			}
		]
	},
	{
		comment: 'Single nucleotide insertion in a repeat region',
		pplink:
			pphost +
			'?genome=hg38&block=1&bamfile=SJACT019118_G1%20WGS,rpaul1/kmers/SJACT019118_G1_SNV.bam&position=chr7:16464-16464&hlregion=chr7:16463-16463&variant=chr7.16464.A.AC',
		leftFlank:
			'AATAGCCTTTACATTATGTAATAGTGTAATACAAATAATAATTTATTATAATAATGTGAAATTATTTACAGTACCCTAACCCTAACCCTAACCCCTAATCCTAACCCTAACCCTAACCCCTAACCCTAATCCTAACCCTAACCCTAACCCTA',
		rightFlank:
			'CCCTAACCCCTAACCCTAACCCGAAAACCCTAACCCTAAAACCCTAACATAACCCTTACCCTTACCCTAATCCTAACCCTAATCCTTACCCTTACCCTTACCCTGACCCTAACCCTAATCCTTACCCTTATCCTACCCCTAACCCTTAACCC',
		seqRef:
			'AATAGCCTTTACATTATGTAATAGTGTAATACAAATAATAATTTATTATAATAATGTGAAATTATTTACAGTACCCTAACCCTAACCCTAACCCCTAATCCTAACCCTAACCCTAACCCCTAACCCTAATCCTAACCCTAACCCTAACCCTAACCCTAACCCCTAACCCTAACCCGAAAACCCTAACCCTAAAACCCTAACATAACCCTTACCCTTACCCTAATCCTAACCCTAATCCTTACCCTTACCCTTACCCTGACCCTAACCCTAATCCTTACCCTTATCCTACCCCTAACCCTTAACCC',
		seqMut:
			'AATAGCCTTTACATTATGTAATAGTGTAATACAAATAATAATTTATTATAATAATGTGAAATTATTTACAGTACCCTAACCCTAACCCTAACCCCTAATCCTAACCCTAACCCTAACCCCTAACCCTAATCCTAACCCTAACCCTAACCCTAACCCCTAACCCCTAACCCTAACCCGAAAACCCTAACCCTAAAACCCTAACATAACCCTTACCCTTACCCTAATCCTAACCCTAATCCTTACCCTTACCCTTACCCTGACCCTAACCCTAATCCTTACCCTTATCCTACCCCTAACCCTTAACCC',
		variant: {
			pos: 16463, // 0-based
			ref: 'A',
			alt: 'AC'
		},
		reads: [
			{
				n: 'Read supports alt allele with an insertion',
				s: 'TAGTAATAATGTGAAATTATTTACAGTACCCTAACCCTAACCCTAACCCCTAATCCTAACCCTAACCCTAACCCCTAACCCTAATCCTAACCCTAACCCTAACCCTAACCCCTAACCCCTAACCCTAACCCTAAAACCCTAACCCTAAAAC',
				p: 16357,
				c: '108M1I42M',
				f: 147,
				g: 'alt0'
			},
			{
				n: 'Read supports ref allele with no insertion but has a distal SNV',
				s: 'ACCCCTAATCCTAACCCTAACCCTAACCCCTAACCCTAATCCTAACCCTAGCCCTAACCCTAACCCTAACCCCTAACCCTAACCCTAAAACCCTAACCCTAAAACCCTAACCATAACCCTTACCCTTACCCTAATCCTAACCCTAATCCTT',
				p: 16402,
				c: '110M1I40M',
				f: 147,
				g: 'ref'
			},
			{
				n: 'Read supports alt allele with the insertion but the nucleotide before it is wrongly called',
				s: 'TAAAGTGAAATTATTGACAGTACCCTAACCCTAACCCTAACCCCTAATCCTAACCCTAACCCTATCCCCTAACCCTAATCCTAACCCTAACCCTAACCCTATCCCCTAACCCCTAACCCTAACCCTAAAACCCTAACCCTAAAACCCTAAC',
				p: 16363,
				c: '101M1I49M',
				f: 83,
				g: 'none',
				g_0: 'alt0'
			}
		]
	},
	{
		comment: 'Complex indel with wrong variant call (wrong indel sequence given)',
		pplink:
			pphost +
			'?genome=hg19&block=1&bamfile=SJAML040555_D2%20WES,rpaul1/kmers/wrong_indel.bam&position=chr4:55589768-55589770&variant=chr4.55589768.CTTACGA.ACGG&bedjfilterbyname=NM_000222',
		leftFlank: 'TGTAGGGATTAGAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGA',
		rightFlank: 'CAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAGCAGAGGTGAGATGATT',
		seqRef:
			'TGTAGGGATTAGAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACGACAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAGCAGAGGTGAGATGATT',
		seqMut:
			'TGTAGGGATTAGAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGAACGGCAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAGCAGAGGTGAGATGATT',
		variant: {
			pos: 55589767, // 0-based
			ref: 'CTTACGA',
			alt: 'ACGG'
		},
		reads: [
			{
				n: 'Read supports none as it contains AGGG sequence (the correct indel sequence). Here the read should be right-aligned as its softclipped to the left',
				s: 'CAGAAATCCTGAAGGGCAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTTCCAGAGGCCCCAATAGATTGGGATTTTTGCCCAGGAACTTA',
				p: 55589775,
				c: '16S82M2S',
				f: 163,
				g: 'none',
				g_0: 'alt0'
			},
			{
				n: 'Read supports none as it contains AGGG sequence (the correct indel sequence).',
				s: 'AGGGATTAGAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATTCTGAAG',
				p: 55589670,
				c: '98M3D2M',
				f: 99,
				g: 'none',
				g_0: 'alt0'
			},
			{
				n: 'Read supports ref as it contains CTT sequence (first three nucleotides of ref allele).',
				s: 'GGGATTAGAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTT',
				p: 55589671,
				c: '100M',
				f: 99,
				g: 'ref',
				g_0: 'ref'
			},
			{
				n: 'Read supports none as it contains AGGG sequence (the correct indel sequence). Here the read should be left-aligned as indel is close to stop position of read',
				s: 'GAAGGGCAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAGCAGAGGTGA',
				p: 55589766,
				c: '2M3D98M',
				f: 147,
				g: 'none',
				g_0: 'alt0'
			},
			{
				n: 'Read supports alt as it only contains "GG" portion of AGGG',
				s: 'GGCAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGGATTTTTGTCCAGGAACTGAGCAGAGGGGAGATG',
				p: 55589773,
				c: '100M',
				f: 99,
				g: 'alt0',
				g_0: 'alt0'
			},
			{
				n: 'Read supports ref allele. Indel closer to end-position so should be left aligned',
				s: 'TGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACGACAGGCTCGTGAATGGGA',
				p: 55589692,
				c: '100M',
				f: 163,
				g: 'ref'
			},
			{
				n: 'Read supports ref allele. Indel closer to start-position of read and should be right aligned',
				s: 'GACTTACGACAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGGGCCCCCAATAGATTGGGATTTTTGTCCAGGAACTGAGCCGAGG',
				p: 55589766,
				c: '100M',
				f: 163,
				g: 'ref'
			},
			{
				n: 'Read supports none as it contains the AGGG correct indel sequence. The indel is closer to end-position so the read should be left-aligned',
				s: 'GAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGAAGGGCAGGCT',
				p: 55589678,
				c: '90M3D10M',
				f: 99,
				g: 'none',
				g_0: 'alt0'
			}
		]
	},

	{
		comment: 'Complex indel with wrong variant call (correct indel sequence given)',
		pplink:
			pphost +
			'?genome=hg19&block=1&bamfile=SJAML040555_D2%20WES,rpaul1/kmers/wrong_indel.bam&position=chr4:55589768-55589770&variant=chr4.55589768.CTTACGA.AGGG&bedjfilterbyname=NM_000222',
		leftFlank: 'TGTAGGGATTAGAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGA',
		rightFlank: 'CAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAGCAGAGGTGAGATGATT',
		seqRef:
			'TGTAGGGATTAGAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACGACAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAGCAGAGGTGAGATGATT',
		seqMut:
			'TGTAGGGATTAGAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGAAGGGCAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAGCAGAGGTGAGATGATT',
		variant: {
			pos: 55589767, // 0-based
			ref: 'CTTACGA',
			alt: 'AGGG'
		},
		reads: [
			{
				n: 'Read supports alt as it contains AGGG sequence (the correct indel sequence). Here the read should be right-aligned as its softclipped to the left',
				s: 'CAGAAATCCTGAAGGGCAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTTCCAGAGGCCCCAATAGATTGGGATTTTTGCCCAGGAACTTA',
				p: 55589775,
				c: '16S82M2S',
				f: 163,
				g: 'alt0'
			},
			{
				n: 'Read supports none as it contains AGGG sequence (the correct indel sequence). Here the read should be right-aligned as its softclipped to the left',
				s: 'AGGGATTAGAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATTCTGAAG',
				p: 55589670,
				c: '98M3D2M',
				f: 99,
				g: 'alt0',
				g_0: 'alt0'
			},
			{
				n: 'Read supports ref as it contains CTT sequence (first three nucleotides of ref allele).',
				s: 'GGGATTAGAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTT',
				p: 55589671,
				c: '100M',
				f: 99,
				g: 'ref',
				g_0: 'ref'
			},
			{
				n: 'Read supports alt as it contains AGGG sequence (the correct indel sequence). Here the read should be right-aligned as indel is close to start position of read',
				s: 'GAAGGGCAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAGCAGAGGTGA',
				p: 55589766,
				c: '2M3D98M',
				f: 147,
				g: 'alt0'
			},
			{
				n: 'Read supports alt as it only contains "GG" portion of AGGG',
				s: 'GGCAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGGATTTTTGTCCAGGAACTGAGCAGAGGGGAGATG',
				p: 55589773,
				c: '100M',
				f: 99,
				g: 'alt0'
			},
			{
				n: 'Read supports ref allele. Indel closer to end-position so should be left aligned',
				s: 'TGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACGACAGGCTCGTGAATGGGA',
				p: 55589692,
				c: '100M',
				f: 163,
				g: 'ref'
			},
			{
				n: 'Read supports ref allele. Indel closer to start-position of read and should be right aligned',
				s: 'GACTTACGACAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGGGCCCCCAATAGATTGGGATTTTTGTCCAGGAACTGAGCCGAGG',
				p: 55589766,
				c: '100M',
				f: 163,
				g: 'ref'
			},
			{
				n: 'Read supports alt as it contains the AGGG correct indel sequence. The indel is closer to end-position so the read should be left-aligned',
				s: 'GAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGAAGGGCAGGCT',
				p: 55589678,
				c: '90M3D10M',
				f: 99,
				g: 'alt0'
			}
		]
	},
	{
		comment: 'Deletion with large number of poor quality reads',
		pplink:
			pphost +
			'?genome=hg19&block=1&position=chr17:48264050-48264100&hlregion=chr17:48264059-48264059&bamfile=SJOS040154_D1-0A4HMC,rpaul1/kmers/KZQR2P0TGL.bam&variant=chr17.48264060.CGGCTGCCCTCTGGGCT.C',
		leftFlank: 'GGCAGGAGTAGGAGGGAGGGAGAGGCTAGGGCAGGCCCTCACCACTCTTCCAGTCAGAGTGGCACATCTTGAGGTCACGGCAGGTGCGGGCGGGGTTCTTG',
		rightFlank: 'CCGGATGTTCTCGATCTGCTGGCTCAGGCTCTTGAGGGTGGTGTCCACCTCGAGGTCACGGTCACGAACCACATTGGCATCATCAGCCCGGTAGTAGCGGC',
		seqRef:
			'GGCAGGAGTAGGAGGGAGGGAGAGGCTAGGGCAGGCCCTCACCACTCTTCCAGTCAGAGTGGCACATCTTGAGGTCACGGCAGGTGCGGGCGGGGTTCTTGCGGCTGCCCTCTGGGCTCCGGATGTTCTCGATCTGCTGGCTCAGGCTCTTGAGGGTGGTGTCCACCTCGAGGTCACGGTCACGAACCACATTGGCATCATCAGCCCGGTAGTAGCGGC',
		seqMut:
			'GGCAGGAGTAGGAGGGAGGGAGAGGCTAGGGCAGGCCCTCACCACTCTTCCAGTCAGAGTGGCACATCTTGAGGTCACGGCAGGTGCGGGCGGGGTTCTTGCCCGGATGTTCTCGATCTGCTGGCTCAGGCTCTTGAGGGTGGTGTCCACCTCGAGGTCACGGTCACGAACCACATTGGCATCATCAGCCCGGTAGTAGCGGC',
		variant: {
			pos: 48264059, // 0-based
			ref: 'CGGCTGCCCTCTGGGCT',
			alt: 'C'
		},
		reads: [
			{
				n: 'Read supports alt allele and softclipped to the right',
				s: 'GCCTTGGTTGGGGTCAATCCAGTACTCTCCACTCTTCCAGTCAGAGTGGCACATCTTGAGGTCACGGCAGGTGCGGGCGGGGTTCTTGCCCGGATGTTCT',
				p: 48263840,
				c: '29M132N60M11S',
				f: 147,
				g: 'alt0'
			},
			{
				n: 'Read supports alt allele, deletion at the center and distal SNV to the left',
				s: 'GGTCAATCCAGTACTCTCCACTCTTCCAGTCAGAGTGGCACATCTTGAGGTCACGGCAGGTGCGGGCGGGGGTCTTGCCCGGATGTTCTCGATCTGCTGG',
				p: 48263851,
				c: '19M132N59M16D22M',
				f: 163,
				g: 'alt0'
			},
			{
				n: 'Read supports ref allele',
				s: 'GGCAGGTGCGGGCGGGGTTCTTGCGGCTGCCCTCTGGGCTCCGGATGTTCTCGATCTGCTGGCTCAGGCTCTTGAGGGTGGTGTCCACCTCGAGGTCACG',
				p: 48264037,
				c: '100M',
				f: 163,
				g: 'ref'
			},
			{
				n: 'Read with very poor base pair quality',
				s: 'CTCCAGTACTCTCCACTCTTCCAGTCAGAGTGGCACATCTTGAGGTCACGGCAGGTGCGGGCGGGGGTTTTGCGGCTGCCCCCTTGGCTCCGGGTGTTTT',
				p: 48263857,
				c: '1S12M132N85M2S',
				f: 99,
				g: 'none',
				g_0: 'ref'
			}
		]
	},
	{
		comment: 'Polyclonal variant',
		pplink:
			pphost +
			'?genome=hg19&block=1&position=chr4:55589660-55589870&hlregion=chr4:55589768-55589768&bamfile=SJCBF041_D,rpaul1/proteinpaint_demo/indel/3ZUAU0RKJN.bam&variant=chr4.55589773.GACAGGC.CTGACAGGCT',
		leftFlank: 'GGGATTAGAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTAC',
		rightFlank:
			'TCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAGCAGAGGTGAGATGATTATTTTT',
		seqRef:
			'GGGATTAGAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACGACAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAGCAGAGGTGAGATGATTATTTTT',
		seqMut:
			'GGGATTAGAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACCTGACAGGCTTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAGCAGAGGTGAGATGATTATTTTT',
		variant: {
			pos: 55589772, // 0-based
			ref: 'GACAGGC',
			alt: 'CTGACAGGCT'
		},
		reads: [
			{
				n: 'Read containing alt allele but spliced on one side and softclipped on the other side',
				s: 'CACATTCCTAGTGTCCAATTCTGACGTCAATGCTGCCATAGCATTTAATGTTTATGTGAATACAAAACCAGAAATCCTGACTTACCTGACAGGCTTCGTGA',
				p: 55575644,
				c: '62M14044N23M2I7M7S',
				f: 163,
				g: 'alt0'
			},
			{
				n: 'Read is spliced and alt allele in the middle of the fragment',
				s: 'CATAGCATTTAATGTTTATGTGAATACAAAACCAGAAATCCTGACTTACCTGACAGGCTTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAG',
				p: 55575680,
				c: '26M14044N27M3I45M',
				f: 83,
				g: 'alt0'
			},
			{
				n: 'Read not spliced but read supporting alt allele',
				s: 'GGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACCTGACAGGCTTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCC',
				p: 55589728,
				c: '45M2I7M1I46M',
				f: 163,
				g: 'alt0'
			},
			{
				n: 'Read containing alt allele not spliced but should be',
				s: 'ATGTGAATACAAAACCAGAAATCCTGACTTACCTGACAGGCTTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGG',
				p: 55589750,
				c: '9S27M3I62M',
				f: 163,
				g: 'alt0'
			},
			{
				n: 'Read containing ref allele and is spliced',
				s: 'GAGGCACTTACACATTCCTAGTGTCCAATTCTGACGTCAATGCTGCCATAGCATTTAATGTTTATGTGAATACAAAACCAGAAATCCTGACTTACGACAGG',
				p: 55575634,
				c: '72M14044N29M',
				f: 83,
				g: 'ref'
			},
			{
				n: 'Read containing ref allele but is not spliced',
				s: 'AGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACGACAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGG',
				p: 55589713,
				c: '101M',
				f: 83,
				g: 'ref'
			},
			{
				n: 'Read (is spliced) containing the other alt allele and therefore should be classified as none',
				s: 'ATGCTGCCATAGCATTTAATGTTTATGTGAATACAAAACCAGAAATCCTGTTTCGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAG',
				p: 55575673,
				c: '33M14044N17M2I2M8D47M',
				f: 163,
				g: 'none',
				g_0: 'ref'
			},
			{
				n: 'Read (not spliced) containing the other alt allele and should be clasified as none',
				s: 'CCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGTTTCGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTC',
				p: 55589711,
				c: '59M6D42M',
				f: 163,
				g: 'none',
				g_0: 'ref'
			}
		]
	},
	{
		comment: 'Other alt allele of the polyclonal variant above',
		pplink:
			pphost +
			'?genome=hg19&block=1&position=chr4:55589660-55589870&hlregion=chr4:55589768-55589768&bamfile=SJCBF041_D,hg19/bams/3ZUAU0RKJN.bam&variant=chr4.55589766.GACTTACGACA.GTTTC',
		leftFlank: 'GGTTGTAGGGATTAGAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCT',
		rightFlank:
			'GGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAGCAGAGGTGAGATGATTATT',
		seqRef:
			'GGTTGTAGGGATTAGAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACGACAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAGCAGAGGTGAGATGATTATT',
		seqMut:
			'GGTTGTAGGGATTAGAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGTTTCGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAGCAGAGGTGAGATGATTATT',
		variant: {
			pos: 55589765, // 0-based
			ref: 'GACTTACGACA',
			alt: 'GTTTC'
		},
		reads: [
			{
				n: 'Read containing first alt allele but spliced on one side and softclipped on the other side',
				s: 'CACATTCCTAGTGTCCAATTCTGACGTCAATGCTGCCATAGCATTTAATGTTTATGTGAATACAAAACCAGAAATCCTGACTTACCTGACAGGCTTCGTGA',
				p: 55575644,
				c: '62M14044N23M2I7M7S',
				f: 163,
				g: 'none',
				g_0: 'ref'
			},
			{
				n: 'Read is spliced and contains first alt allele in the middle of the fragment',
				s: 'CATAGCATTTAATGTTTATGTGAATACAAAACCAGAAATCCTGACTTACCTGACAGGCTTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAG',
				p: 55575680,
				c: '26M14044N27M3I45M',
				f: 83,
				g: 'none',
				g_0: 'ref'
			},
			{
				n: 'Read not spliced but read supporting first alt allele',
				s: 'GGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACCTGACAGGCTTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCC',
				p: 55589728,
				c: '45M2I7M1I46M',
				f: 163,
				g: 'none',
				g_0: 'ref'
			},
			{
				n: 'Read containing first alt allele not spliced but should be',
				s: 'ATGTGAATACAAAACCAGAAATCCTGACTTACCTGACAGGCTTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGG',
				p: 55589750,
				c: '9S27M3I62M',
				f: 163,
				g: 'none',
				g_0: 'ref'
			},
			{
				n: 'Read containing ref allele and is spliced',
				s: 'GAGGCACTTACACATTCCTAGTGTCCAATTCTGACGTCAATGCTGCCATAGCATTTAATGTTTATGTGAATACAAAACCAGAAATCCTGACTTACGACAGG',
				p: 55575634,
				c: '72M14044N29M',
				f: 83,
				g: 'ref'
			},
			{
				n: 'Read containing ref allele but is not spliced',
				s: 'AGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACGACAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGG',
				p: 55589713,
				c: '101M',
				f: 83,
				g: 'ref'
			},
			{
				n: 'Read (is spliced) containing the current alt allele and therefore should be classified as none',
				s: 'ATGCTGCCATAGCATTTAATGTTTATGTGAATACAAAACCAGAAATCCTGTTTCGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAG',
				p: 55575673,
				c: '33M14044N17M2I2M8D47M',
				f: 163,
				g: 'alt0'
			},
			{
				n: 'Read (not spliced) containing the current alt allele',
				s: 'CCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGTTTCGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTC',
				p: 55589711,
				c: '59M6D42M',
				f: 163,
				g: 'alt0'
			},
			{
				n: 'Read is spliced on one side and softclipped on the other and contain ght current alt allele',
				s: 'CACTTACACATTCCTAGTGTCCAATTCTGACGTCAATGCTGCCATAGCATTTAATGTTTATGTGAATACAAAACCAGAAATCCTGTTTCGGCTCGTGAATG',
				p: 55575638,
				c: '68M14044N17M2D2M14S',
				f: 83,
				g: 'alt0'
			}
		]
	},
	{
		comment: 'Insertion at close proximity to splice-site in SETD2 gene',
		pplink:
			pphost +
			'?genome=hg19&block=1&position=chr3:47155260-47155500&hlregion=chr3:47155365-47155365&bamfile=SJAML001417_D1,rpaul1/kmers/ZEDH37MVSK.bam&variant=chr3.47155366.G.GGGGCT',
		leftFlank: 'GGTTCCAGTGAGCCAAGATCGTGCCACTGCACTCCAGTCTGGGTGAAAGAGTGAGACCTTGTCTCAAAAAAGGAAGTGAAAGGTAATTAAAAAAGAACTTAC',
		rightFlank:
			'AAGGAAGGTCTTTGGCAGCTCTCAAGCCCCAGCCTTTCTTTTCTGTGAGTATGACTTCCACATCTGCATGCTGTTTTCTCTGAAACCGTCTATTGGAACAAT',
		seqRef:
			'GGTTCCAGTGAGCCAAGATCGTGCCACTGCACTCCAGTCTGGGTGAAAGAGTGAGACCTTGTCTCAAAAAAGGAAGTGAAAGGTAATTAAAAAAGAACTTACGAAGGAAGGTCTTTGGCAGCTCTCAAGCCCCAGCCTTTCTTTTCTGTGAGTATGACTTCCACATCTGCATGCTGTTTTCTCTGAAACCGTCTATTGGAACAAT',
		seqMut:
			'GGTTCCAGTGAGCCAAGATCGTGCCACTGCACTCCAGTCTGGGTGAAAGAGTGAGACCTTGTCTCAAAAAAGGAAGTGAAAGGTAATTAAAAAAGAACTTACGGGGCTAAGGAAGGTCTTTGGCAGCTCTCAAGCCCCAGCCTTTCTTTTCTGTGAGTATGACTTCCACATCTGCATGCTGTTTTCTCTGAAACCGTCTATTGGAACAAT',
		variant: {
			pos: 47155365, // 0-based
			ref: 'G',
			alt: 'GGGGCT'
		},
		reads: [
			{
				n: 'Read is spliced on one side and insertion on side of predicted indel region',
				s: 'GACAAAGGTGTTCGGGGCTAAGGAAGGTCTTTGGCAGCTCTCAAGCCCCAGCCTTTCTTTTCTGTGAGTATGACTTCCACATCTGCATGCTGTTTTCTCTG',
				p: 47147598,
				c: '13M7755N1M5I82M',
				f: 147,
				g: 'alt0'
			},
			{
				n: 'Read is spliced and insertion is on another fragment instead of in the predicted indel region',
				s: 'CACTCGAGCTTTAAACTCTTTATGATCGAGTACCTCTCCACAATATTCTAGGACAAAGGTGTTCGGGGCTAAGGAAGGTCTTTGGCAGCTCTCAAGCCCCA',
				p: 47147547,
				c: '64M4I2M7754N31M',
				f: 147,
				g: 'alt0'
			},
			{
				n: 'Read not spliced but contains alt allele',
				s: 'CCTTGTCTCAAAAAAGGAAGTGAAAGGTAATTAAAAAAGAACTTACGGGGCTAAGGAAGGTCTTTGGCAGCTCTCAAGCCCCAGCCTTTCTTTTCTGTGAG',
				p: 47155320,
				c: '47M5I49M',
				f: 147,
				g: 'alt0'
			},
			{
				n: 'Read supporting ref allele but is spliced',
				s: 'GATCGAGTACCTCTCCACAATATTCTAGGACAAAGGTGTTCGAAGGAAGGTCTTTGGCAGCTCTCAAGCCCCAGCCTTTCTTTTCTGTGAGTATGACTTTC',
				p: 47147570,
				c: '41M7755N60M',
				f: 147,
				g: 'ref'
			},
			{
				n: 'Read supporting ref allele but is not spliced',
				s: 'AGAGTGAGACCTTGTCTCAAAAAAGGAAGTGAAAGGTAATTAAAAAAGAACTTACGAAGGAAGGTCTTTGGCAGCTCTCAAGCCCCAGCCTTTCTTTTCTG',
				p: 47155311,
				c: '101M',
				f: 147,
				g: 'ref'
			},
			{
				n: 'Ambiguous read',
				s: 'AGGAAGGTCTTTGGCAGCTCTCAAGCCCCAGCCTTTCTTTTCTGTGAGTATGACTTCCACATCTGCATGCTGTTTTCTCTGAAACCGTCTATTGGAACAAT',
				p: 47155368,
				c: '101M',
				f: 147,
				g: 'amb'
			}
		]
	},
	{
		comment: 'Example of an SNV',
		pplink:
			pphost +
			'?genome=hg38&block=1&bamfile=snp1,rpaul1/kmers/snp1.bam&position=chr11:102839171-102839291&variant=chr11.102839232.C.T',
		leftFlank: 'CATCCACGCCTGAAGGAAGAGATGGCCAAAATGAAGAGATCAAATGCAATTCAGGTTCAAGCTTCCTGAGGGATTTG',
		rightFlank: 'GCCAAAAGTGCCTAAAATATATGTAAAAAGAAATGTAAATTGAAAAACAATCTTTCACCTTTAGAATATTTTCCTCA',
		seqRef:
			'CATCCACGCCTGAAGGAAGAGATGGCCAAAATGAAGAGATCAAATGCAATTCAGGTTCAAGCTTCCTGAGGGATTTGCGCCAAAAGTGCCTAAAATATATGTAAAAAGAAATGTAAATTGAAAAACAATCTTTCACCTTTAGAATATTTTCCTCA',
		seqMut:
			'CATCCACGCCTGAAGGAAGAGATGGCCAAAATGAAGAGATCAAATGCAATTCAGGTTCAAGCTTCCTGAGGGATTTGTGCCAAAAGTGCCTAAAATATATGTAAAAAGAAATGTAAATTGAAAAACAATCTTTCACCTTTAGAATATTTTCCTCA',
		variant: {
			pos: 102839231, // 0-based
			ref: 'C',
			alt: 'T'
		},
		reads: [
			{
				n: 'Read containing alt allele without any splicing',
				s: 'CACGCCTGAAGGAAGAGATGGCCAAAATGAAGAGATCAAATGCAATTCAGGTTCAAGCTTCCTGAGGGATTTGTGC',
				p: 102839159,
				c: '76M',
				f: 99,
				g: 'alt0'
			},
			{
				n: 'Read containing alt allele with splicing',
				s: 'TGCAATTCAGGGTCAAGCTTCCTGAGGCATTTGTGCCAAAAGTGCCTGTCTTTAAAGATCAGGATTTCTNCCCTCA',
				p: 102839199,
				c: '45M864N31M',
				f: 147,
				g: 'alt0'
			},

			{
				n: 'Read containing ref allele without any splicing',
				s: 'CTGAAGGAAGAGATGGCCAAAATGAAGAGATCAAATGCAATTCAGGTTCAAGCTTCCTGAGGGATTTGCGCCAAAA',
				p: 102839164,
				c: '76M',
				f: 99,
				g: 'ref'
			},
			{
				n: 'Read containing ref allele with splicing',
				s: 'CAAAATGAAGAGATCAAATGCAATTCAGGTTCAAGCTTCCTGAGGGATTTGCGCCAAAAGTGCCTGTCTTTAAAGA',
				p: 102839181,
				c: '63M864N13M',
				f: 163,
				g: 'ref'
			}
		]
	},
	{
		comment: 'Insertion of G/GAAA at repeat region',
		pplink:
			pphost +
			'?genome=hg38&block=1&position=chr22:19933882-19934882&hlregion=chr22:19934381-19934381&bamfile=SJNHL019482_G1,tempbamslice/ZHT0TK9XAO.bam&variant=chr22.19934382.G.GAAA',
		leftFlank:
			'TACTCTAAAAGGAGAAACTGCAGGGCCCACAGTCCCAGCTACTAGGGAGGCTGAGGCTGGAGGGTGAGTTGAACCCAGGAGTTCAAGGCTGCAGTGAGCTATGATAGCACCACTGCACTCCAGCCTGGTTAACAGAGTGAGACTCTGTCTCA',
		rightFlank:
			'AAAAAAAAAAAAAAAAAAACTGCACCCCTAGTCTGGGTACAGTGGCTCACACCTGTGTTGCAGGAAGTCAGGAACCCCGAATGGAGGGACTGGCTGGAGCCGTGGCAGAGGAACATAAATAGTGAAGATTTCATTTCAATATGAACATTTAT',
		seqRef:
			'TACTCTAAAAGGAGAAACTGCAGGGCCCACAGTCCCAGCTACTAGGGAGGCTGAGGCTGGAGGGTGAGTTGAACCCAGGAGTTCAAGGCTGCAGTGAGCTATGATAGCACCACTGCACTCCAGCCTGGTTAACAGAGTGAGACTCTGTCTCAGAAAAAAAAAAAAAAAAAAACTGCACCCCTAGTCTGGGTACAGTGGCTCACACCTGTGTTGCAGGAAGTCAGGAACCCCGAATGGAGGGACTGGCTGGAGCCGTGGCAGAGGAACATAAATAGTGAAGATTTCATTTCAATATGAACATTTAT',
		seqMut:
			'TACTCTAAAAGGAGAAACTGCAGGGCCCACAGTCCCAGCTACTAGGGAGGCTGAGGCTGGAGGGTGAGTTGAACCCAGGAGTTCAAGGCTGCAGTGAGCTATGATAGCACCACTGCACTCCAGCCTGGTTAACAGAGTGAGACTCTGTCTCAGAAAAAAAAAAAAAAAAAAAAAACTGCACCCCTAGTCTGGGTACAGTGGCTCACACCTGTGTTGCAGGAAGTCAGGAACCCCGAATGGAGGGACTGGCTGGAGCCGTGGCAGAGGAACATAAATAGTGAAGATTTCATTTCAATATGAACATTTAT',
		variant: {
			pos: 19934381, // 0-based
			ref: 'G',
			alt: 'GAAA'
		},
		reads: [
			{
				n: 'Read supporting alt allele with 3A insertion',
				s: 'AGCTACTAGGGAGGCTGAGGCTGGAGGGTGAGTTGAGCCCAGGAGTTCAAGGCTGCAGTGAGCTATGATAGCACCACTGCACTCCAGCCTGGTTAACAGAGTGAGACTCTGTCTCAGAAAAAAAAAAAAAAAAAAAAAACTGCACCCCTAG',
				p: 19934266,
				c: '117M3I31M',
				f: 99,
				g: 'alt0'
			},
			{
				n: 'Read containing alt allele with 3A insertion that is softclipped to the right',
				s: 'GGGAGGCTGAGGCTGGAGGGTGAGTTGAGCCCAGGAGTTCAAGGCTGCAGTGAGCTATGATAGCACCACTGCACTCCAGCCTGGTTAACAGAGTGAGACTCTGTCTCAGAAAAAAAAAAAAAAAAAAAAAACAGAACCCCTAGTCGGGGTA',
				p: 19934274,
				c: '128M23S',
				f: 163,
				g: 'alt0'
			},
			{
				n: 'Read containing ref allele with no 3A insertion',
				s: 'AAGGCTGCAGTGAGCTATGATACCCCCACTGAACTCCAGCCTGGTTAACAGAGTGAGACTCGGGCTCAGAAAAAAAAAAAAAAAAAAACTGCACCCCTAGTCTGGGTACAGTGGCTCACACCTGTGTTGCAGGAAGTCAGGAACCCCGAAT',
				p: 19934314,
				c: '151M',
				f: 83,
				g: 'ref'
			},
			{
				n: 'Read containing only 2A insertion',
				s: 'GGGGGGGGGGGGGCTGGGGGGGGGGTTGAGCCCGGGGGTTAAAGGCTGCAGTGAGCTATGATAGCCCCACTGCCCTCCAGCCTGGTTAACAGAGTGAGACTCTGTCTCAGAAAAAAAAAAAAAAAAAAAAACTGCACCCCTAGTCTGGGTA',
				p: 19934314,
				c: '41S69M2I39M',
				f: 83,
				g: 'none',
				g_0: 'alt0'
			},
			{
				n: 'Read containing 1A deletion instead of insertion',
				s: 'ACTAGGGAGGCTGAGGCGGAGGGGGGAGTTGAACCCAGGAGTTCAAGCCGGCGGGGAGCTCTGAGAGCACCACGGCCCCCCAGCCTGGTTAACAGAGTGAGACTTTGTTTCAGAAAAAAAAAAAAAAAAAACTGCACCCCTAGTCTGGGTA',
				p: 19934270,
				c: '113M1D38M',
				f: 147,
				g: 'none',
				g_0: 'ref'
			}
		]
	},
	{
		comment: 'Insertion of C/CTTT at repeat region',
		pplink:
			pphost +
			'?genome=hg38&block=1&position=chr22:19934066-19935066&hlregion=chr22:19934565-19934565&bamfile=SJSTS052625_G1,tempbamslice/GJ5084AHW9.bam&variant=chr22.19934566.C.CTTT',
		leftFlank:
			'TCTGGGTACAGTGGCTCACACCTGTGTTGCAGGAAGTCAGGAACCCCGAATGGAGGGACTGGCTGGAGCCGTGGCAGAGGAACATAAATAGTGAAGATTTCATTTCAATATGAACATTTATCAATTCCCAAGTAATACTTTTATACTTTTTT',
		rightFlank:
			'TTTTTTTTTTTTTTGAGGCAGATTCTCTCTCTGTCGCCCAGGCTGGGGTGCAGTGGCACAATCTCAGCTCACTGCAAGCTCCGCCTCCTGGGTTCACACCATTCTCCTGTCTCAGCCTCCTGAGTAGCTGGGACTACAGGCACCCGCCACCA',
		seqRef:
			'TCTGGGTACAGTGGCTCACACCTGTGTTGCAGGAAGTCAGGAACCCCGAATGGAGGGACTGGCTGGAGCCGTGGCAGAGGAACATAAATAGTGAAGATTTCATTTCAATATGAACATTTATCAATTCCCAAGTAATACTTTTATACTTTTTTCTTTTTTTTTTTTTTGAGGCAGATTCTCTCTCTGTCGCCCAGGCTGGGGTGCAGTGGCACAATCTCAGCTCACTGCAAGCTCCGCCTCCTGGGTTCACACCATTCTCCTGTCTCAGCCTCCTGAGTAGCTGGGACTACAGGCACCCGCCACCA',
		seqMut:
			'TCTGGGTACAGTGGCTCACACCTGTGTTGCAGGAAGTCAGGAACCCCGAATGGAGGGACTGGCTGGAGCCGTGGCAGAGGAACATAAATAGTGAAGATTTCATTTCAATATGAACATTTATCAATTCCCAAGTAATACTTTTATACTTTTTTCTTTTTTTTTTTTTTTTTGAGGCAGATTCTCTCTCTGTCGCCCAGGCTGGGGTGCAGTGGCACAATCTCAGCTCACTGCAAGCTCCGCCTCCTGGGTTCACACCATTCTCCTGTCTCAGCCTCCTGAGTAGCTGGGACTACAGGCACCCGCCACCA',
		variant: {
			pos: 19934565, // 0-based
			ref: 'C',
			alt: 'CTTT'
		},
		reads: [
			{
				n: 'Read containing 3T insertion',
				s: 'CAGGGACCCCGAATGGAGGGACTGGCTGGAGCCGTGGCAGAGGAACATAAATAGTGAACATTTCATTTCAATATGAACATTTATCAATTCCCAAGTAATACTTTTATACTTTTTTCTTTTTTTTTTTTTTTTTGAGGCAGATTCTCTCTCT',
				p: 19934451,
				c: '116M3I32M',
				f: 83,
				g: 'alt0'
			},
			{
				n: 'Read contains 3T insertion but the cigar sequence shows only 2T insertion',
				s: 'TACTTTTATACTTTTTTCTTTTTTTTTTTTTTTTTAGGCAGATTCTCTCACTGTCGCCCAGGCTGGGGTGCAGTGGCACAATCTCAGCTCACTGCAAGCACCGCCACCTGGGTTCACACCATTCTCCTGTCTCAGCCTCCTGAGTAGCTGG',
				p: 19934549,
				c: '18M2I131M',
				f: 163,
				g: 'alt0'
			},
			{
				n: 'Read contains no T insertion and supports ref allele',
				s: 'CTGGAGCCGTGGCAGAGGAACATAAATAGTGAAGATTTCATTTCAATATGAACATTTATCAATTCCCAAGTAATACTTTTATACTTTTTTCTTTTTTTTTTTTTTGAGGCAGATTCTCTCTCTGTCGCCCAGGCTGGGGTGCAGTGGCACA',
				p: 19934476,
				c: '151M',
				f: 99,
				g: 'ref'
			},
			{
				n: 'Read contains 2T insertion and therefore suppports neither ref nor alt allele',
				s: 'CCGGGACCCCGAATGGAGGGACTGGCTGGAGCCGTGGCAGAGGAACATAAATAGTGAAGATTTCATTTCAATATGAACATTTATCAATTCCCAAGTAATACTTTTATACTTTTTTCTTTTTTTTTTTTTTTTGAGGCAGATTCTCT',
				p: 19934451,
				c: '116M2I28M',
				f: 81,
				g: 'none',
				g_0: 'alt0'
			},
			{
				n: 'Read contains 1T insertion and therefore suppports neither ref nor alt allele',
				s: 'GAATGGAGGGACTGGCTGGAGCCGTGGCAGAGGAACATAAATAGTGAAGATTTCATTTCAATATGAACATTTATCAATTCCCAAGTAATACTTTTATACTTTTTTCTTTTTTTTTTTTTTTGAGGCAGATT',
				p: 19934461,
				c: '106M1I24M',
				f: 145,
				g: 'none',
				g_0: 'ref'
			}
		]
	},
	{
		comment: 'Huge deletion in BCORL1 gene',
		pplink:
			pphost +
			'?genome=hg19&block=1&bamfile=SJALL015963_D1-PARKLL%20WXS,rpaul1/kmers/SJALL015963_D1.bam&position=chrX:129150008-129150048&variant=chrX.129150027.GGAAAGCGTAGGGGTCTTTGCTTGCAAGAACAA.GT',
		leftFlank: 'TTCAATTTAGCCACCTGCTTCCGGGCTGATGGCCTCCCAGTGGCTCCCCAGAGGGGCCAAGCTGAAGTTCGGGCTAAGGCCGGGCAGGCTCGAGTGAAACA',
		rightFlank: 'GTGGCAGCCAGATGATGTGACGGAATCTCTGCCGCCCAAGAAGATGAAGTGCGGCAAAGAGAAGGACAGTGAAGAGCAGCAGCTCCAGCCACAAGCCAAGG',
		seqRef:
			'TTCAATTTAGCCACCTGCTTCCGGGCTGATGGCCTCCCAGTGGCTCCCCAGAGGGGCCAAGCTGAAGTTCGGGCTAAGGCCGGGCAGGCTCGAGTGAAACAGGAAAGCGTAGGGGTCTTTGCTTGCAAGAACAAGTGGCAGCCAGATGATGTGACGGAATCTCTGCCGCCCAAGAAGATGAAGTGCGGCAAAGAGAAGGACAGTGAAGAGCAGCAGCTCCAGCCACAAGCCAAGG',
		seqMut:
			'TTCAATTTAGCCACCTGCTTCCGGGCTGATGGCCTCCCAGTGGCTCCCCAGAGGGGCCAAGCTGAAGTTCGGGCTAAGGCCGGGCAGGCTCGAGTGAAACAGTGTGGCAGCCAGATGATGTGACGGAATCTCTGCCGCCCAAGAAGATGAAGTGCGGCAAAGAGAAGGACAGTGAAGAGCAGCAGCTCCAGCCACAAGCCAAGG',
		variant: {
			pos: 129150026, // 0-based
			ref: 'GGAAAGCGTAGGGGTCTTTGCTTGCAAGAACAA',
			alt: 'GT'
		},
		reads: [
			{
				n: 'Read contains alt allele but is softclipped to the right',
				s: 'GGGCTTATTGCCTCCCAGTGGCTCCCCAGAGGGGCCAAGCTGAAGTTCGGGCTAAGGCCGGGCAGGCTCGAGTGAAACAGTGTGGCAGCCAGATGATGTG',
				p: 129149948,
				c: '80M20S',
				f: 163,
				g: 'alt0'
			},
			{
				n: 'Read contains alt allele to the right but shown as mismatched nucleotides with respect to ref sequence',
				s: 'GCCACCTGCTTCCGGGCTGATGGCCTCCCAGTGGCTCCCCAGAGGGGCCAAGCTGAAGTTCGGGCTAAGGCCGGGCAGGCTCGAGTGAAACAGTGTGGCA',
				p: 129149935,
				c: '100M',
				f: 99,
				g: 'alt0'
			},
			{
				n: 'Read containing alt allele in the middle of the read and shown as a deletion',
				s: 'CTCCCAGTGGCTCCCCAGAGGGGCCAAGCTGAAGTTCGGGCTAAGGCCGGGCAGGCTCGAGTGAAACAGTGTGGCAGCCAGATGATGTGACGGAATCTCT',
				p: 129149959,
				c: '68M7D2M24D30M',
				f: 147,
				g: 'alt0'
			},
			{
				n: 'Read containing alt allele but softclipped to the left',
				s: 'AGTTCGGGCTAAGGCCGGGCAGGCTCGAGTGAAACAGTGTGGCAGCCAGATGATGTGACGGAATCTCTGCCGCCCAAGAAGATGAAGTGCGGCAAAGAGA',
				p: 129150060,
				c: '38S62M',
				f: 83,
				g: 'alt0'
			},
			{
				n: 'Read supporting alt allele but close to start position of read resulting in mismatches',
				s: 'GAAACAGTGTGGCAGCCAGATGATGTGACGGAATCTCTGCCGCCCAAGAAGATGAAGTGCGGCAAAGAGAAGGACAGTGAAGAGCAGCAGCTCCAGCCAC',
				p: 129150053,
				c: '6M1I93M',
				f: 83,
				g: 'alt0'
			},
			{
				n: 'Read supporting ref allele',
				s: 'AGGGGCCAAGCTGAAGTTCGGGCTAAGGCCGGGCAGGCTCGAGTGAAACAGGAAAGCGTAGGGGTCTTTGCTTGCAAGAACAAGTGGCAGCCAGATGATG',
				p: 129149977,
				c: '100M',
				f: 83,
				g: 'ref'
			},
			{
				n: 'Read supports ref allele but has a mismatch in the ref allele sequence',
				s: 'GGCAGGCTCGAGTGAAACAGGAAAGCGTAGGTGTCTTTGCTTGCAAGAACAAGTGGCAGCCAGATGATGTTACGGAATCTCTGCCGCCCAAGAAGATGAA',
				p: 129150008,
				c: '100M',
				f: 147,
				g: 'none',
				g_0: 'ref'
			}
		]
	},
	{
		comment: '1A nucleotide deletion in repeat A region',
		pplink:
			pphost +
			'?genome=hg38&block=1&bamfile=SJACT019118_G1%20WGS,rpaul1/kmers/SJACT019118_G1.bam&position=chr7:148846501-148846701&hlregion=chr7:148846600-148846600&variant=chr7.148846602.A.',
		leftFlank:
			'CAACATGTTATGTTAACCAACCTCCCTAGTCCCGCGCAATGAGCTCACAGAAGTCAGGATGTGCACAGGCTGTATCCTTCGCTGTTTCCATTCTTGGTTTAAGATTTCCGTTCTTTCCAAAATTTTCTGACGATTGGAACTAAACATACTCT',
		rightFlank:
			'AAAAAAAAAATGAAGGAGAGGAAAGGAGAAATTGTTCATTGTTAGAAAATGTATAACACCTGTAAAGCAGGTTAAAAATCTAGTGTATCCTCAAAAATATCAAGAACATTTTCTTAGGTGCATATAGATTTTACACTATAGTTTCCCACATT',
		seqRef:
			'CAACATGTTATGTTAACCAACCTCCCTAGTCCCGCGCAATGAGCTCACAGAAGTCAGGATGTGCACAGGCTGTATCCTTCGCTGTTTCCATTCTTGGTTTAAGATTTCCGTTCTTTCCAAAATTTTCTGACGATTGGAACTAAACATACTCTTAAAAAAAAAAATGAAGGAGAGGAAAGGAGAAATTGTTCATTGTTAGAAAATGTATAACACCTGTAAAGCAGGTTAAAAATCTAGTGTATCCTCAAAAATATCAAGAACATTTTCTTAGGTGCATATAGATTTTACACTATAGTTTCCCACATT',
		seqMut:
			'CAACATGTTATGTTAACCAACCTCCCTAGTCCCGCGCAATGAGCTCACAGAAGTCAGGATGTGCACAGGCTGTATCCTTCGCTGTTTCCATTCTTGGTTTAAGATTTCCGTTCTTTCCAAAATTTTCTGACGATTGGAACTAAACATACTCTTAAAAAAAAAATGAAGGAGAGGAAAGGAGAAATTGTTCATTGTTAGAAAATGTATAACACCTGTAAAGCAGGTTAAAAATCTAGTGTATCCTCAAAAATATCAAGAACATTTTCTTAGGTGCATATAGATTTTACACTATAGTTTCCCACATT',
		variant: {
			pos: 148846600, // 0-based
			ref: 'TA',
			alt: 'T'
		},
		reads: [
			{
				n: 'Read supports 1A deletion but deletion shown as a mismatch towards the end of read',
				s: 'TAACCAACCTCCCTAGTCCCGCGCAATGAGCTCACAGAAGTCAGGATGTGCACAGGCTGTATCCTTCGCTGTTTCCATTCTTGGTTTAAGATTTCCGTTCTTTCCAAAATTTTCTGACGATTGGAACTAAACATACTCTTAAAAAAAAAAT',
				p: 148846462,
				c: '151M',
				f: 163,
				g: 'alt0'
			},
			{
				n: 'Read supports 1A deletion which is in the middle of the read',
				s: 'TCGCTGTTTCCATTCTTGGTTTAAGATTTCCGTTCTTTCCAAAATTTTCTGACGATTGGAACTAAACATACTCTTAAAAAAAAAATGAAGGAGAGGAAAGGAGAAATTGTTCATTGTTAGAAAATGTATAACATCTGTAAAGCAGGTTAAA',
				p: 148846527,
				c: '75M1D76M',
				f: 99,
				g: 'alt0'
			},
			{
				n: 'Read supports 1A deletion but deletion shown as a mismatch towards the beginning of read',
				s: 'TTAAAAAAAAAATGAAGGAGAGGAAAGGAGAAATTGTTCATTGTTAGAAACTGTATAACATCTGTAAAGCAGGTTAAAAATCTAGTGTATCCTCAAAAATATCAAGAACATTTTCTTAGGTGCTTATAGAATTTACACTATAGTTTCCCAC',
				p: 148846601,
				c: '151M',
				f: 147,
				g: 'alt0'
			},
			{
				n: 'Read supports ref allele but variant region towards end of read',
				s: 'CCAACCTCCCTAGTCCCGCGCAATGAGCTCACAGAAGTCAGGATGTGCACAGGCTGTATCCTTCGCTGTTTCCATTCTTGGTTTAAGATTTCCGTTCTTTCCAAAATTTTCTGACGATTGGAACTAAACATACTCTTAAAAAAAAAAATGA',
				p: 148846465,
				c: '151M',
				f: 99,
				g: 'ref'
			},
			{
				n: 'Read supports ref allele where variant region is in the middle of the read',
				s: 'TGCACAGGCTGTATCCTTCGCTGTTTCCATTCTTGGTTTAAGATTTCCGTTCTTTCCAAAATTTTCTGACGATTGGAACTAAACATACTCTTAAAAAAAAAAATGAAGGAGAGGAAAGGAGAAATTGTTCATTGTTAGAAAATGTATAACA',
				p: 148846510,
				c: '151M',
				f: 147,
				g: 'ref'
			},
			{
				n: 'Read supports ref allele but variant region towards the beginning of read',
				s: 'ACTCTTAAAAAAAAAAATGAAGGAGAGGAAAGGAGAAATTGTTCATCGATAGAAAATGTATAACACCTGTAACGCAGGTTAAAAATCTAGTGTATCCTCAAAAATATCAAGAACATTTTCTTAGGTGCTTATAGATTTTACACTATAGTTT',
				p: 148846596,
				c: '151M',
				f: 163,
				g: 'ref'
			},
			{
				n: 'Read containing 1A insertion instead of deletion',
				s: 'GGTTCCATTCTTAGTTTAAGATTTCCGTTCTTTCCAAAATTTTCTGACGATTGGAACTAAACATACTCTTAAAAAAAAAAAATGAAGGAGAGGAAAGGAGAAATTGTTCATTGTTAGAAAATGTATAACACCTGTAAAGCAGGTTAAAAAT',
				p: 148846532,
				c: '70M1I80M',
				f: 147,
				g: 'none',
				g_0: 'ref'
			},
			{
				n: 'Read containing 1T substitution instead of deletion',
				s: 'CCCTCCCTAGTCCCGCGCAATGAGCTCACAGAAGTCATGATGTGCACAGGCTGTATCCTTCCCTGTTTCCATTCTTGGTATAAGATTTCCGTTCTTTCCAAAATTTTCTGCCGATTGGAACTAAACATACTCTTAAAAAAAATAATGAAGG',
				p: 148846468,
				c: '151M',
				f: 83,
				g: 'none',
				g_0: 'amb'
			},
			{
				n: 'Read does not contain the entire A repeat region, so cannot determine of it supports ref or alt allele',
				s: 'TATGTTAACCAACCCCCCTAGTCCCGCGCAATGAGCTCACAGAAGTCAGTATGTGCACAGGCTGTATCCTTCGCTGTTTCCATTCTTGGTTTAAGATTTCCGTTCTTTCCAAAATTTTCTGACGATTGGAACTAAACATACTCTTAAAAAA',
				p: 148846457,
				c: '151M',
				f: 147,
				g: 'amb'
			}
		]
	},
	{
		comment: 'TGT sequence deletion where same sequence is repeated on the right',
		pplink:
			pphost +
			'?genome=hg38&block=1&bamfile=GDC_MYC_3bp_del,rpaul1/kmers/GDC_MYCdeletion.bam&position=chr8:127740225-127740625&variant=&variant=chr8.127740426.ATGT.A',
		leftFlank: 'GCATTAATCTGGTAATTGATTATTTTAATGTAACCTTGCTAAAGGAGTGATTTCTATTTCCTTTCTTAAAGAGGAGGAACAAGAAGATGAGGAAGAAATCG',
		rightFlank: 'TGTTTCTGTGGAAAAGAGGCAGGCTCCTGGCAAAAGGTCAGAGTCTGGATCACCTTCTGCTGGAGGCCACAGCAAACCTCCTCACAGCCCACTGGTCCTCA',
		seqRef:
			'GCATTAATCTGGTAATTGATTATTTTAATGTAACCTTGCTAAAGGAGTGATTTCTATTTCCTTTCTTAAAGAGGAGGAACAAGAAGATGAGGAAGAAATCGATGTTGTTTCTGTGGAAAAGAGGCAGGCTCCTGGCAAAAGGTCAGAGTCTGGATCACCTTCTGCTGGAGGCCACAGCAAACCTCCTCACAGCCCACTGGTCCTCA',
		seqMut:
			'GCATTAATCTGGTAATTGATTATTTTAATGTAACCTTGCTAAAGGAGTGATTTCTATTTCCTTTCTTAAAGAGGAGGAACAAGAAGATGAGGAAGAAATCGATGTTTCTGTGGAAAAGAGGCAGGCTCCTGGCAAAAGGTCAGAGTCTGGATCACCTTCTGCTGGAGGCCACAGCAAACCTCCTCACAGCCCACTGGTCCTCA',
		variant: {
			pos: 127740425, // 0-based
			ref: 'ATGT',
			alt: 'A'
		},
		reads: [
			{
				n: 'Read contains deletion towards the end of read',
				s: 'GGTAATTGATTATTTTAATGTAACCTTGCTAAAGGAGTGATTTCTATTTCCTTTCTTAAAGAGGAGGAACAAGAAGATGAGGAAGAAATCGATGTTTCTG',
				p: 127740335,
				c: '96M4S',
				f: 147,
				g: 'alt0'
			},
			{
				n: 'Read contains deletion in the middle of the read',
				s: 'AAAGGAGTGATTTCTATTTCCTTTCTTAAAGAGGAGGAACAAGAAGATGAGGAAGAAATCGATGTTTCTGTGGAAAAGAGGCAGGCTCCTGGCAAAAGGT',
				p: 127740335,
				c: '62M3D38M',
				f: 99,
				g: 'alt0'
			},
			{
				n: 'Read contains deletion towards the beginning of read',
				s: 'AATCGATGTTTCTGTGGAAAAGAGGCAGGCTCCTGGCAAAAGGTCAGAGTCTGGATCACCTTCTGCTGGAGGCCACAGTAAACCTCCTCACAGCCCACTG',
				p: 127740421,
				c: '6M3D94M',
				f: 99,
				g: 'alt0'
			},
			{
				n: 'Read contains variant region towards the end of read but no deletion',
				s: 'CTGGTAATTGATTATTTTAATGTAACCTTGCTAAAGGAGTGATTTCTATTTCCTTTCTTAAAGAGGAGGAACAAGAAGATGAGGAAGAAATCGATGTTGT',
				p: 127740333,
				c: '100M',
				f: 163,
				g: 'ref'
			},
			{
				n: 'Read supporting ref allele and variant region in the middle of the read',
				s: 'TAACCTTGCTAAAGGAGTGATTTCTATTTCCTTTCTTAAAGAGGAGGAACAAGAAGATGAGGAAGAAATCGATGTTGTTTCTGTGGAAAAGAGGCAGGCT',
				p: 127740355,
				c: '100M',
				f: 147,
				g: 'ref'
			},
			{
				n: 'Read contains variant region towards the beginning of read but no deletion',
				s: 'CGATGTTGTTTCTGTGGAAAAGAGGCAGGCTCCTGGCAAAAGGTCAGAGTCTGGATCACCTTCTGCTGGAGGCCACAGCAAACCTCCTCACAGCCCACTG',
				p: 127740424,
				c: '100M',
				f: 147,
				g: 'ref'
			},
			{
				n: 'Read supporting ref allele but mismatch in ref allele due to wrong bp call',
				s: 'AGGAAGAAATCGATATTGTTTCTGTGGAAAAGAGGCAGGCTCCTCGCAAAAGGCCAGAGGCCGGGTCCCCTTCTGCTGGAGGCCACCGCAAACCTCCTCC',
				p: 127740414,
				c: '100M',
				f: 163,
				g: 'none',
				g_0: 'ref'
			},
			{
				n: 'Read does not contain the variant region and the adjoining TGT monomer region so cannot determine whether read supports ref or alt allele',
				s: 'ATCTGGTAATTGATTATTTTAATGTAACCTTGCTAAAGGAGTGATTTCTATTTCCTTTCTTAAAGAGGAGGAACAAGAAGATGAGGAAGAAATCGATGTT',
				p: 127740331,
				c: '100M',
				f: 147,
				g: 'amb'
			}
		]
	},
	{
		comment: 'Insertion of 3Ts in a region which already contains 5Ts',
		pplink:
			pphost +
			'?genome=hg19&block=1&bamfile=MSK-VB-0023_g_raw_sort.bam%20WXS,rpaul1/kmers/MSK-VB-0023_g_raw_sort.bam&position=chr1:241661077-241661470&variant=chr1.241661227.A.ATTT',
		leftFlank:
			'TTTAAATTTTATACATGTTTATTTTCATTATAAATTTATGTAAATCACTTTGGACCCAGCATGTCCTTAGGTTTTACCCATTCGTCAAACTGCTCTGCTGTGAGATAGCCAAGTTCGATAGCAGTTTCCTTTAAGGTTGATCC',
		rightFlank:
			'TTTTTGTGTGCTGTCTTAGCAATCTTTGCTGCCTTGTCATACCCTGAAGAAAAAATAAAAAGACGACATATGGGTTAGCAGTGATATTTGGTTTCCTAAAGCAAAAGGTGACATAATTGTTTACTTGATATTGATGCTATATG',
		seqRef:
			'TTTAAATTTTATACATGTTTATTTTCATTATAAATTTATGTAAATCACTTTGGACCCAGCATGTCCTTAGGTTTTACCCATTCGTCAAACTGCTCTGCTGTGAGATAGCCAAGTTCGATAGCAGTTTCCTTTAAGGTTGATCCATTTTTGTGTGCTGTCTTAGCAATCTTTGCTGCCTTGTCATACCCTGAAGAAAAAATAAAAAGACGACATATGGGTTAGCAGTGATATTTGGTTTCCTAAAGCAAAAGGTGACATAATTGTTTACTTGATATTGATGCTATATG',
		seqMut:
			'TTTAAATTTTATACATGTTTATTTTCATTATAAATTTATGTAAATCACTTTGGACCCAGCATGTCCTTAGGTTTTACCCATTCGTCAAACTGCTCTGCTGTGAGATAGCCAAGTTCGATAGCAGTTTCCTTTAAGGTTGATCCATTTTTTTTGTGTGCTGTCTTAGCAATCTTTGCTGCCTTGTCATACCCTGAAGAAAAAATAAAAAGACGACATATGGGTTAGCAGTGATATTTGGTTTCCTAAAGCAAAAGGTGACATAATTGTTTACTTGATATTGATGCTATATG',
		variant: {
			pos: 241661226, // 0-based
			ref: 'A',
			alt: 'ATTT'
		},
		reads: [
			{
				n: 'Read contains insertion towards the end of read',
				s: 'ATACATGTTTATTTTCATTATAAATTTATGTAAATCACTTTGGACCCAGCATGTCCTTAGGTTTTACCCATTCGTCAAACTGCTCTGCTGTGAGATAGCCAAGTTCGATAGCAGTTTCCTTTCAGGTTGATCCATTTTTTTT',
				p: 241661094,
				c: '139M3S',
				f: 163,
				g: 'alt0'
			},
			{
				n: 'Read contains insertion in the middle of read',
				s: 'ACCCAGCATGTCCTTAGGTTTTACCCATTCGTCAAACTGCTCTGCTGTGAGATAGCCAAGTTCGATAGCAGTTTCCTTTAAGGTTGATCCATTTTTTTTGTGTGCTGTCTTAGCAATCTTTGCTGCCTTGTCATACCCTGA',
				p: 241661137,
				c: '91M3I47M',
				f: 99,
				g: 'alt0'
			},
			{
				n: 'Read contains insertion towards the beginning of read',
				s: 'ATTTTTTTTGTGTGCTGTCTTAGCAATCTTTGCTGCCTTGTCATACCCTGAAGAAAAAATAAAAAGACGACATATGGGTTAGCAGTGATATTTGGTTTCCTAAAGCAAAAGGTGACATAATTGTTTACTTGATATTGATGCT',
				p: 241661228,
				c: '4S138M',
				f: 83,
				g: 'alt0'
			},
			{
				n: 'Read supports ref allele and contains variant region towards the end of read',
				s: 'TTAGGTTTTACCCATTCGTCAAACTGCTCTGCTGTGAGATAGCCAAGTTCGATAGCAGTTTCCTTTAAGGTTGATCCATTTTTGTGTGCTGTCTTAGCAATCTTTGCTGCCTTGTCATACCCTGAAGAAAAA',
				p: 241661150,
				c: '132M',
				f: 163,
				g: 'ref'
			},
			{
				n: 'Read supports ref allele and contains variant region in the middle of read',
				s: 'TAGGTTTTACCCATTCGTCAAACTGCTCTGCGGTGAGATAGCCAAGTTCGATAGCAGTTTCCTTTAAGGTTGATCCATTTTTGTGTGCTGTCTTAGCAATCTTTGCTGCCTTGTCATACCCTGACGAAAAAATAAAAAGACG',
				p: 241661151,
				c: '142M',
				f: 163,
				g: 'ref'
			},
			{
				n: 'Read supports ref allele and contains variant region towards the beginning of read',
				s: 'ATTTTTGTGTGCTGTCTTAGCAATCTTTGCTGCCTTGTCATACCCTGAAGAAAAAATAAAAAGACGACATATGGGTTAGCAGTGATATTTGGTTTCCTAAAGCAAAAGGTGACATAATTGTTTACTTGATATTGATGCTAT',
				p: 241661227,
				c: '141M',
				f: 99,
				g: 'ref'
			},
			{
				n: 'Read supports alt allele but contains wrong variant call in the insertion. It contains A instead of T. The variant region is towards the end of the read',
				s: 'CATTATAAATTTATGTAAATCACTTTGGACCCAGCATGTCCTTAGGGTTTACCCATTCGTCAAACTTCTCTGCTGTGAGATAGCCAAGTTCGATAGCAGTTTCCTTTAAGGTTGATCCATTTTTATTGTGTACGGTCTTAGC',
				p: 241661109,
				c: '122M3I17M',
				f: 163,
				g: 'none',
				g_0: 'alt0'
			},
			{
				n: 'Read contains 4T insertions instead of 3T',
				s: 'CACTTTGGACCCAGCATGTCCTTAGGTTTTACCCATTCGTCAAACTGCTCTGCTGTGAGATAGCCAAGTTCGATAGCAGTTTCCTTTAAGGTTGATCCATTTTTTTTTGTGTGCTGTCTTAGCAATCTTTGCTGCCTTGTC',
				p: 241661129,
				c: '99M4I38M',
				f: 1633,
				g: 'none',
				g_0: 'alt0'
			},
			{
				n: 'Read contains 2T insertions instead of 3T',
				s: 'AGGTTGATCCATTTTTTTGTGTGCTGTCTTAGCAATCTTTGCTGCCTTGTCATACCCTGAAGAAAAAATAAAAAGACGACATATGGGTTAGCAGTGATATTTGGTTTCCTAAAGCAAAAGGTGACATAATTGTTTACTTGAT',
				p: 241661217,
				c: '11M2I129M',
				f: 147,
				g: 'none',
				g_0: 'alt0'
			},
			{
				n: 'Read does not cover the entire region of 5Ts towards end of read, so impossible to determine if it supports ref or alt allele',
				s: 'TTATACATGTTTATTTTCATTATAAATTTATGTAAATCACTTTGGACCCAGCATGTCCTTAGGTTTTACCCATTCGTCAAACTGCTCTGCTGTGAGATAGCCAAGTTCGATAGCAGTTTCCTTTAAGGTTGATCCATTTTT',
				p: 241661092,
				c: '141M',
				f: 147,
				g: 'amb'
			},
			{
				n: 'Read does not cover the entire region of 5Ts at the beginning of read, so impossible to determine if it supports ref or alt allele',
				s: 'TTTTGTGTGCTGTCTTAGCAATCTTTGCTGCCTTGTCATACCCTGAAGAAAAAATAAAAAGACGACATATGGGTTAGCAGTGATATTTGGTTTCCTAAAGCAAAAGGTGACATAATTGTTTACTTGATATTGATGCTATATG',
				p: 241661229,
				c: '142M',
				f: 163,
				g: 'amb'
			}
		]
	},
	{
		comment: 'Complex indel in which left side is repeating where G insertion is shown outside of variant region',
		pplink:
			pphost +
			'?genome=hg19&block=1&position=chr2:25964927-25965927&hlregion=chr2:25965426-25965426&bamfile=SJAML040538_D2-PANLIZ,rpaul1/proteinpaint_demo/indel/9MA6S7W3PX.bam&variant=chr2.25965427.GTC.GGTT',
		leftFlank: 'GAACAGTAGAACTGAAAAGCTCGGGGCTGCTACGGATTGCCTTACCTCTCACTGCATGAGCCATCTGCTTCTGTGCTGCCTGAATTAAATCTCTGGCTAGG',
		rightFlank: 'TTTTCATCAAATGTTTGGCCTCTAGTGAACAGGTAATTCTCCTTACTTAAAGTGGTTTGCTCATTCAATGGTATCTCAGCCTTCACATTCTTGCTAGCTAA',
		seqRef:
			'GAACAGTAGAACTGAAAAGCTCGGGGCTGCTACGGATTGCCTTACCTCTCACTGCATGAGCCATCTGCTTCTGTGCTGCCTGAATTAAATCTCTGGCTAGGGTCTTTTCATCAAATGTTTGGCCTCTAGTGAACAGGTAATTCTCCTTACTTAAAGTGGTTTGCTCATTCAATGGTATCTCAGCCTTCACATTCTTGCTAGCTAA',
		seqMut:
			'GAACAGTAGAACTGAAAAGCTCGGGGCTGCTACGGATTGCCTTACCTCTCACTGCATGAGCCATCTGCTTCTGTGCTGCCTGAATTAAATCTCTGGCTAGGGGTTTTTTCATCAAATGTTTGGCCTCTAGTGAACAGGTAATTCTCCTTACTTAAAGTGGTTTGCTCATTCAATGGTATCTCAGCCTTCACATTCTTGCTAGCTAA',
		variant: {
			pos: 25965426, // 0-based
			ref: 'GTC',
			alt: 'GGTT'
		},
		reads: [
			{
				n: 'Read contains alt allele close to end of read',
				s: 'ACTGAAAAGCTCGGGGCTGCTACGGATTGCCTTACCTCTCACTGCATGAGCCATCTGCTTCTGTGCTGCCTGAATTAAATCTCTGGCTAGGGGTTTTTTC',
				p: 25965336,
				c: '89M1I10M',
				f: 83,
				g: 'alt0'
			},
			{
				n: 'Read contains alt allele in the middle of the read',
				s: 'CACTGCATGAGCCATCTGCTTCTGTGCTGCCTGAATTAAATCTCTGGCTAGGGGTTTTTTCATCAAATGTTTGGCCTCTAGTGAACAGGTAATTCTCCTT',
				p: 25965375,
				c: '50M1I49M',
				f: 99,
				g: 'alt0'
			},
			{
				n: 'Read contains alt allele in the beginning of the read',
				s: 'TAGGGGTTTTTTCATCAAATGTTTGGCCTCTAGTGAACAGGTAATTCTCCTTACTTAAAGTGGTTTGCTCATTCAATGGTATCTCAGCCTTCACATTCTT',
				p: 25965422,
				c: '100M',
				f: 147,
				g: 'alt0'
			},
			{
				n: 'Read contains one nucleotide of alt at the beginning of the read',
				s: 'TTTTTCATCAAATGTTTGGCCTCTAGTGAACAGGTAATTCTCCTTACTTAAAGTGGTTTGCTCATTCAATGGTATCTCAGCCTTCACATTCTTGCTAGAT',
				p: 25965429,
				c: '100M',
				f: 163,
				g: 'alt0'
			},
			{
				n: 'Read contains ref allele in the end of the read',
				s: 'TAGAACTGAAAAGCTCGGGGCTGCTACGGATTGCCTTACCTCTCACTGCATGAGCCATCTGCTTCTGTGCTGCCTGAATTAAATCTCTGGCTAGGGTCTT',
				p: 25965332,
				c: '100M',
				f: 147,
				g: 'ref'
			},
			{
				n: 'Read contains ref allele in the middle of the read',
				s: 'CATGAGCCATCTGCTTCTGTGCTGCCTGAATTAAATCTCTGGCTAGGGTCTTTTCATCAAATGTTTGGCCTCTAGTGAACAGGTAATTCTCCTTACTTAA',
				p: 25965380,
				c: '100M',
				f: 99,
				g: 'ref'
			},
			{
				n: 'Read contains ref allele in the beginning of the read',
				s: 'GTCTTTTCATCAAATGTTTGGCCTCTAGTGAACAGGTAATTCTCCTTACTTAAAGTGGTTTGCTCATTCAATGGTATCTCAGCCTTCACATTCTTGCTAG',
				p: 25965427,
				c: '100M',
				f: 147,
				g: 'ref'
			},
			{
				n: 'Read contains mismatch at variant region, seems to support ref allele more',
				s: 'AAAAGCTCGGGGCTGCTACGGATTGCCTTACCTCTCACTGCATGAGCCATCTGCTTCTGTGCTGCCTGAATTAAATCTCTGGCTAGGGGCTTTTCATCAA',
				p: 25965340,
				c: '100M',
				f: 163,
				g: 'none',
				g_0: 'ref'
			}
		]
	},
	{
		comment: 'Insetion of 3monomeric GCT in a region consisting of GCT monomers on the left hand side',
		pplink:
			pphost +
			'?genome=hg38&block=1&bamfile=SJALL003102_G1%20WGS,rpaul1/kmers/SJALL003102_G1.bam&position=chr7:35473-35473&hlregion=chr7:35472-35472&variant=chr7.35473.T.TGCTGCTGCT',
		leftFlank:
			'AGTCACTCAGTTACCTGAATGCTTTTTTCACAAAGGGATGACTGTGCTGCTCCGTCTTCCTTCTTTTTTGTTTGCAAGGCCACAGGGAAATCTGGATCCTCTGGTGAAAAAGCAAATCCAGTTGCTGCTGCTGCTGCTGCTGCTGCTGCTGC',
		rightFlank:
			'GCCGCCGCCGCCGCCGGTTCTTGTAAATGTCCTCACTTGGTTTCTGGGCAGCAACTTCCTTGACTTGCCTGGGGAGCGGATCTGAGCTGCATTTACCAGGCCATGCCCAGGGGAAGTGATCAGTGTGGGACCGTGAAGCTGGATTTCCCCAG',
		seqRef:
			'AGTCACTCAGTTACCTGAATGCTTTTTTCACAAAGGGATGACTGTGCTGCTCCGTCTTCCTTCTTTTTTGTTTGCAAGGCCACAGGGAAATCTGGATCCTCTGGTGAAAAAGCAAATCCAGTTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCCGCCGCCGCCGCCGGTTCTTGTAAATGTCCTCACTTGGTTTCTGGGCAGCAACTTCCTTGACTTGCCTGGGGAGCGGATCTGAGCTGCATTTACCAGGCCATGCCCAGGGGAAGTGATCAGTGTGGGACCGTGAAGCTGGATTTCCCCAG',
		seqMut:
			'AGTCACTCAGTTACCTGAATGCTTTTTTCACAAAGGGATGACTGTGCTGCTCCGTCTTCCTTCTTTTTTGTTTGCAAGGCCACAGGGAAATCTGGATCCTCTGGTGAAAAAGCAAATCCAGTTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCCGCCGCCGCCGCCGGTTCTTGTAAATGTCCTCACTTGGTTTCTGGGCAGCAACTTCCTTGACTTGCCTGGGGAGCGGATCTGAGCTGCATTTACCAGGCCATGCCCAGGGGAAGTGATCAGTGTGGGACCGTGAAGCTGGATTTCCCCAG',
		variant: {
			pos: 35472, // 0-based
			ref: 'T',
			alt: 'TGCTGCTGCT'
		},
		reads: [
			{
				n: 'Read containing alt allele consiting of 3 monomeric GCT insertions shown as mismatches of T',
				s: 'GCTTTTTTCACAAAGGGATGACTGTGCTGCTCCGTCTTCCTTCTTTTTTGTTTGCAAGGCCACAGGGAAAGCTGGATCCTCTGGTGAAAAAGCAAATCCAGTTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCCGCCGCC',
				p: 35341,
				c: '149M2S',
				f: 83,
				g: 'alt0'
			},
			{
				n: 'Read containing alt allele consiting of 3 monomeric GCT insertions but those insertions shown are far from predicted variant region consist of repeat monomeric GCT',
				s: 'CAAAGGGATGACTGTGCTGCTCCGTCTTCCTTCTTTTTTGTTTGCAAGGCCACAGGGAAAGCTGGATCCTCTGGTGAAAAAGCAAATCCAGTTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCCGCCGCCGCCGCCGGTT',
				p: 35351,
				c: '92M9I50M',
				f: 83,
				g: 'alt0'
			},
			{
				n: 'Read containing alt allele consiting of 2 monomeric GCT insertions (instead of 3) shown as mismatches of T',
				s: 'TCACAAAGGGATGACTGTGCTGCTCCGTCTTCCTTCTTTTTTGTTTGCAAGGCCACAGGGAAATCTGGATCCTCTGGTGAAAAAGCAAATCCAGTTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCCGCCGCCGCCGCCAGTT',
				p: 35348,
				c: '142M9S',
				f: 147,
				g: 'none',
				g_0: 'alt0'
			},
			{
				n: 'Read containing alt allele consiting of 3 monomeric GCC deletions on the right instead of 3 monomeric GCT insertions',
				s: 'TTGCGAGGCCACAGGGAAATCTGGATCCTCTGGTGAAAAAGCAAATCCAGTTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCCGGTTCTTGTAAATGTCCTCACTTGGTTTCTGGGCAGCAACTTCCTTGACTTGCCTGGGGAGCGGAT',
				p: 35392,
				c: '82M12D69M',
				f: 163,
				g: 'none',
				g_0: 'ref'
			},
			{
				n: 'Read containing alt allele consiting of 3 monomeric GCC deletions on the right instead of 3 monomeric GCT insertions',
				s: 'TTGCGAGGCCACAGGGAAATCTGGATCCTCTGGTGAAAAAGCAAATCCAGTTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCCGGTTCTTGTAAATGTCCTCACTTGGTTTCTGGGCAGCAACTTCCTTGACTTGCCTGGGGAGCGGAT',
				p: 35392,
				c: '82M12D69M',
				f: 163,
				g: 'none',
				g_0: 'ref'
			},
			{
				n: 'Read does not contain entire indel repeat region, so cannot classify into ref or alt allele',
				s: 'TGCTGCTGCTGCTGCTGCTGCTGCCGCCGCCGCCGCCGGTTCTTGTAAATGTCCTCACTTGGTTTCTGGGCAGCAACTTCCTTGACTTGCCTGGGGAGCGGATCTGAGCTGCATTTACCAGGCCATGCCCAGGGGAAGTGATCAGTGTGGG',
				p: 35452,
				c: '151M',
				f: 163,
				g: 'amb'
			}
		]
	}
]
