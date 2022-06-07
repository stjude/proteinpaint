const tape = require('tape')
const path = require('path')
const spawn = require('child_process').spawn
const Readable = require('stream').Readable
const additionalExamples = require('./indel.examples')
//const utils = require('../../src/utils')

/*
to compile rust, see server/utils/rust/README.md
Syntax for compiling the rust code: cd ~/proteinpaint/server/utils/rust && cargo build --release

run as: $ node indel.spec.js

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
const groupkeys = ['ref', 'alt', 'none', 'amb'] // corresponds to the same values returned by rust

/**************
 Test sections
***************/
tape('\n', function(test) {
	test.pass('-***- rust indel specs -***-')
	test.end()
})

tape('rust indel binary', async function(test) {
	const strictness_values = [0, 1] // Array containing the possible number of strictness values
	for (const strictness of strictness_values) {
		console.log('Testing with strictness=', strictness)
		for (const e of examples) {
			await runTest(e, test, strictness)
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
	for (const r of e.reads) {
		if (!r.s) throw '.s (sequence) missing from a read'
		if (!Number.isInteger(r.p)) throw '.p (position) not integer from a read'
		if (!r.c) throw '.c (cigar) missing from a read'
		if (!groupkeys.includes(r.g)) throw '.g (group) is invalid for a read'
		if (!Number.isInteger(r.f)) throw '.f (flag) not integer for a read'
	}

	// compose input string
	const input =
		e.seqRef +
		'-' +
		e.seqMut +
		'-' +
		e.reads.map(i => i.s).join('-') + // reads
		'_' +
		e.reads.map(i => i.p).join('-') + // position
		'_' +
		e.reads.map(i => i.c).join('-') + // cigar
		'_' +
		e.reads.map(i => i.f).join('-') + // flag
		'_' +
		e.variant.pos + // Variant position
		'_' +
		e.variant.ref + // Reference allele
		'_' +
		e.variant.alt + // Alternate allele
		'_' +
		strictness + // Strictness value
		'_' +
		e.leftFlank + // Left flank sequence
		'_' +
		e.rightFlank // Right flank sequence

	try {
		const stdout = await run_rust('indel', input)
		let groups, indices
		for (const line of stdout.split('\n')) {
			if (line.includes('output_cat')) {
				groups = line
					.replace(/"/g, '')
					.replace(/,/g, '')
					.replace('output_cat:', '')
					.split(':')
			} else if (line.includes('output_gID')) {
				indices = line
					.replace(/"/g, '')
					.replace(/,/g, '')
					.replace('output_gID:', '')
					.split(':')
					.map(Number)
			}
		}
		if (!groups) throw 'output_cat: line missing'
		if (!indices) throw 'output_gID: line missing'
		test.equal(groups.length, indices.length, 'output_cat and output_gID should be same length')
		test.equal(indices.length, e.reads.length, 'indices.length should equal e.reads.length')

		const results = [] // in the same order as e.reads[]
		for (let i = 0; i < indices.length; i++) results[indices[i]] = groups[i]

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
	} catch (e) {
		throw e
	}
}

const examples = [
	// one object for each example

	// additional examples from separate script
	...additionalExamples.examples,

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
				g: 'alt'
			},
			{
				n: 'softclip on right',
				s: 'CTTCTCCATTCTCCATGGCCCCACAAGCTTCCCTTCCCCCGGTGCCACCACGACTTGACCTGGTGACCTTCTGCC',
				p: 119155692,
				c: '61M14S',
				f: 163,
				g: 'alt'
			},
			{
				n: 'insertion at right',
				s: 'TCCATTCTCCATGGCCCCACAAGCTTCCCTTCCCCCGGTGCCACCACGACTTGACCTGGTGACCTTCTGCCGCAG',
				p: 119155696,
				c: '51M8I16M',
				f: 83,
				g: 'alt'
			},
			{
				n: 'insertion at left',
				s: 'AAGCTTCCCTTCCCCCGGTGCCACCACGACTTGACCTGGTGACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAG',
				p: 119155716,
				c: '37M8I30M',
				f: 163,
				g: 'alt'
			},
			{
				n: 'softclip on left',
				s: 'CCACGACTTGACCTGGTGACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAGTGCTTCTGCTCTTGGAACTGCTT',
				p: 119155731,
				c: '16S59M',
				f: 163,
				g: 'alt'
			},
			{
				n: 'softclip on left',
				s: 'CTTGACCTGGTGACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAGTGCTTCTGCTCTTGGAACTGCTTCTAAGG',
				p: 119155737,
				c: '10S65M',
				f: 163,
				g: 'alt'
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
				g_0: 'alt'
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
				g: 'alt'
			},
			{
				n: 'with softclip',
				s: 'GCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACAGGCTCGTGAATGGCATGCTCCAAAGTGTGGCAGGAGGGTTTCCCGAGGCCCCAAA',
				p: 55589729,
				c: '44M56S',
				f: 99,
				g: 'alt'
			},
			{
				n: 'with del',
				s: 'AGAAATCCTGACTTACAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGGAGGGTTCCCCGAGCCCCCAATAGATTGGGATTTTTGTCCAGGGACTGAG',
				p: 55589757,
				c: '14M3D40M46S',
				f: 99,
				g: 'alt'
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
				s:
					'CAAATTTCCTTCCACTCGGATAAGATGCTGAGGAGGGGCCAGACCTAAGAGCAATCAGTGAGGAATCAGAGGCCTGGGGACCCTGGGCAACCAGCCCTGTCGTCTCTCCAGCCCCAGCTGCTCACCATCGCTATCTGAGCAGCGCCTCACA',
				p: 7578246,
				c: '144M1I6M',
				f: 99,
				g: 'alt'
			},
			{
				n: 'mismatch on right',
				s:
					'ACGCAAATTTCCTTCCACTCGGATAAGATGCTGAGGAGGGGCCAGACCTAAGAGCAATCAGTGAGGAATCAGAGGCCTGGGGACCCTGGGCCACCAGCCCTGTCGTCTCTCCAGCCCCAGCTGCTCACCATCGCTATCTGAGCAGCGCCTC',
				p: 7578243,
				c: '151M',
				f: 163,
				g: 'alt'
			},
			{
				n: 'Softclip on right',
				s:
					'TTCCACTCGGATAAGATGCTGAGGAGGGGCCAGACCTAAGAGCAATCAGTGAGGAATCAGAGGCCTGGGGACCCTGGGCAACCAGCCCTGTCGTCTCTCCAGCCCCAGCTGCTCACCATCGCTATCTGAGCAGCGCCTCACAACCTCCGTC',
				p: 7578255,
				c: '136M15S',
				f: 99,
				g: 'alt'
			},
			{
				n: 'Insertion only on right',
				s:
					'CGCAAATTTCCTTCCACTCGGATAAGATGCTGAGGAGGGGCCAGACCTAAGAGCAATCAGTGAGGAATCAGAGGCCTGGGGACCCTGGGCAACCAGCCCTGTCGTCTCTCCAGCCCCAGCTGCTCACCATCGCTATCTGAGCAGCGCCTCA',
				p: 7578244,
				c: '146M1I14M',
				f: 83,
				g: 'alt'
			},
			{
				n: 'Deletion in middle of read',
				s:
					'TAAGATGCTGAGGAGGGGCCAGACCTAAGAGCAATCAGTGAGGAATCAGAGGCCTGGGGACCCTGGGCAACCAGCCCTGTCGTCTCTCCAGCCCCAGCTGCTCACCATCGCTATCTGAGCAGCGCCTCACAACCTCCGTCATGTGCTGTGA',
				p: 7578266,
				c: '118M18D33M',
				f: 99,
				g: 'alt'
			},
			{
				n: 'Softclip on left',
				s:
					'TGCTCACCATCGCTATCTGAGCAGCGCCTCACAACCTCCGTCATGTGCTGTGACTGCTTGTAGATGGCCATGGCGCGGACGCGGGTGCCGGGCGGGGGTGTGGAATCAACCCACAGCTGCACAGGGCAGGTCTTGGCCAGTTGGCAAAACA',
				p: 7578382,
				c: '20S131M',
				f: 147,
				g: 'alt'
			},
			{
				n: 'Mismatch on left',
				s:
					'CTATCTGAGCAGCGCCTCACAACCTCCGTCATGTGCTGTGACTGCTTGTAGATGGCCATGGCGCGGACGCGGGTGCCGGGCGGGGGTGTGGAATCAACCCACAGCTGCACAGGGCAGGTCTTGGCCAGTTGGCAAAACATCTTGTTGAGGG',
				p: 7578394,
				c: '151M',
				f: 147,
				g: 'alt'
			},
			{
				n: 'Deletion (supporting alt) with mismatch, different strictness values gives different results',
				s:
					'GAATCAGAGGCCTGGGGACCCTGGGCAACCAGCCCTGTCGTCTCTCCAGCCCCAGCTGCTCACCATCGCTATCTGCGCAGCGCCTCACACCCTCCGTCATGTGCTGTGACTGCTTGTAGATGGCCATGGCGCGGACGCGGGTGCCGGGCGG',
				p: 7578308,
				c: '74M18D77M',
				f: 163,
				g: 'none',
				g_0: 'alt' // Value for strictness = 0
			},
			{
				n:
					'Read supporting reference but with mismatch at variant region, different strictness values gives different results',
				s:
					'GGGCAACCAGCCCTGTCGTCTCTCCAGCCCCAGCTGCTCACCATCGCTATCTGAGCAGCGCCCATGGTGGGGGCGGCGCCTCACAACCTCCGTCATGTGCTGTGACTGCTTGTAGATGGCCATGGCGCGGACGCGCGTGCCGGGCGGGGGT',
				p: 7578330,
				c: '151M',
				f: 83,
				g: 'none',
				g_0: 'ref' // Value for strictness = 0
			},
			{
				n: 'Read supporting reference but mismatch is outside variant, both strictness values should yield same result',
				s:
					'GGGCAACCAGCCCTGTCGTCTCTCCAGCCCCAGCTGCTCACCATCGCTATCTGAGCAGCGCTCATGGTGGGGGCGGCGCCTCACAACCTCCGTCATGTGCTGTGACTGCTTGTAGATGGCCATGGCGCGGACGCGGGTGCCGGGCGGGGGT',
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
				s:
					'GAGTGCCTCAAGTACCAGGTGCCCCTGCCCGACAGCATGAAGCTGGAGTCGTCCCACTCCCGTGGCAGCATGACCGCCCTGGGTGGAGCCTCCTCGTCGACCCACCACCCCATCACCCCTGCCTGTTGTGAGCTGCTCTACG',
				p: 8100570,
				c: '117M25S',
				f: 147,
				g: 'alt'
			},
			{
				n: 'read supporting alt but wrong bp in alternate allele',
				s:
					'CGCTGGCGTCGCCCCACTCCCGTGGCAGCATGACCGCCCTAGGTGGAGCCTCCTCGTCGACCCGCCGCCCCATCGCCCCTGCCTGTTGTGAGCTGCTCGACGTGCCCTACGTGCTCTACCCGCCCTACGTGCCCGAGTACAG',
				p: 8100610,
				c: '74M68S',
				f: 147,
				g: 'none',
				g_0: 'alt'
			},
			{
				n: 'read supporting ref allele',
				s:
					'CGTCCCACTCCCGCGGCAGCATGACCGCCCTGGGTGGAGCCTCCTCGTCGACCCACCACCCCATCACCACCTACCCGCCCTACGTGCCCGAGTACAGCTCCGGACTCTTCCCCCCCAGCAGCCTGCTGGGCGGACGCCCCAC',
				p: 8100619,
				c: '133M9S',
				f: 163,
				g: 'ref'
			},
			{
				n: 'Read supporting ref allele but has wrong bp in variant region',
				s:
					'ATGGAGCTGGAGTCCTCCCCCTCCCGCGGCAGCCTGACCGCCCTGGGTGGGGCCCCCTCGGCGACCCCCCCCCCCCTCCCCCCCCACCCGCCCTACGTGCCCGGGTACAGCCCCCGGCTCTTCCCCCCCCAGCAGCCTGCTG',
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
				g: 'alt'
			},
			{
				n: 'read not spliced but should be spliced on the left side but is instead softclipped',
				s: 'CTCTTCCGATCTGTATACTTCAGGTATTATATTTTTGTCCCGGTTTTAAATCTGGAGTAAAGCACTTATTTAATATTATTTCAAGGAAGAAAGCTCTAAAG',
				p: 62907864, // In the bam track read info panel the start position is misleading as the number of softclipped nucleotides is subtracted from the original position reported in the bam file
				c: '21S72M3D8M',
				f: 83,
				g: 'alt'
			},
			{
				n: 'normal read with alt allele and no splicing',
				s: 'TATTATATTTTTGTCCCGGTTTTAAATCTGGAGTAAAGCACTTATTTAATATTATTTCAAGGAAGAAAGCTCTAAAGGATGAAGCCAATCAAAAAGACAAG',
				p: 62907867,
				c: '66M3D35M',
				f: 83,
				g: 'alt'
			},
			{
				n: 'splicing on right side of the read, variant on left fragment',
				s: 'AAAGCACTTATTTAATATTATTTCAAGGAAGAAAGCTCTAAAGGATGAAGCCAATCAAAAAGACAAGGGAAATTGCAAAGAAGATTCTTTGGCAAGTTATG',
				p: 62907901,
				c: '32M3D35M859N34M',
				f: 163,
				g: 'alt'
			},
			{
				n: 'read is softclipped on the left',
				s: 'CCGATCTAAAGCTCTAAAGGATGAAGCCAATCAAAAAGACAAGGGAAATTGCAAAGAAGATTCTTTGGCAAGTTATGAATTGATATGCAGTTTACAGTCCG',
				p: 62907936,
				c: '8S35M859N57M1S',
				f: 83,
				g: 'alt'
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
				g: 'alt'
			},
			{
				n: 'Insertion in middle of read but wrong bp nucleotide away from variant region',
				s: 'GGGTTCCTTAACCACATTTTTTTTTTTTTTTTTCCAGGCTATTCAAGATCTCTGTCTGGTAGTGGAGGAAGTCTCTTTAAGAAAATAGTTTAAACAATTT',
				p: 171410490,
				c: '50M4I46M',
				f: 147,
				g: 'alt'
			},
			{
				n: 'Read supports alt allele and softclipped to the left',
				s: 'CTCTGTCTGGCAGTGGAGGAAGTCTCTTTAAGAAAATAGTTTAAACAATTTGTTAAAAAATTTTCCGTCTTATTTCATTTCTGTAACAGTTGATATCTGG',
				p: 171410540,
				c: '5S95M',
				f: 83,
				g: 'alt'
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
				g_0: 'alt'
			},
			{
				n: 'Read supporting alternate allele but contains a mismatch in the flanking region similar to insertion',
				s: 'GTTGTGGTTCCTTAACCACATTTCTTTTTTTTTTTTTCCAGGCTATTCAAGATCTCTGGCTGGCAGTGGAGGAAGTCTCTTTAAGAAAATAGTTTAAACA',
				p: 171410486,
				c: '55M4I41M',
				f: 147,
				g: 'none',
				g_0: 'alt'
			},
			{
				n:
					'Read finishes near the adjoining region of the flanking region of the insertion which has the same sequence as the insertion itself, read is also hard-clipped at the end',
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
			'/?genome=hg38&block=1&bamfile=SJACT019118_G1%20WGS,rpaul1/kmers/SJACT019118_G1_SNV.bam&position=chr7:16464-16464&hlregion=chr7:16463-16463&variant=chr7.16464.A.AC',
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
				s:
					'TAGTAATAATGTGAAATTATTTACAGTACCCTAACCCTAACCCTAACCCCTAATCCTAACCCTAACCCTAACCCCTAACCCTAATCCTAACCCTAACCCTAACCCTAACCCCTAACCCCTAACCCTAACCCTAAAACCCTAACCCTAAAAC',
				p: 16357,
				c: '108M1I42M',
				f: 147,
				g: 'alt'
			},
			{
				n: 'Read supports ref allele with no insertion but has a distal SNV',
				s:
					'ACCCCTAATCCTAACCCTAACCCTAACCCCTAACCCTAATCCTAACCCTAGCCCTAACCCTAACCCTAACCCCTAACCCTAACCCTAAAACCCTAACCCTAAAACCCTAACCATAACCCTTACCCTTACCCTAATCCTAACCCTAATCCTT',
				p: 16402,
				c: '110M1I40M',
				f: 147,
				g: 'ref'
			},
			{
				n: 'Read supports alt allele with the insertion but the nucleotide before it is wrongly called',
				s:
					'TAAAGTGAAATTATTGACAGTACCCTAACCCTAACCCTAACCCCTAATCCTAACCCTAACCCTATCCCCTAACCCTAATCCTAACCCTAACCCTAACCCTATCCCCTAACCCCTAACCCTAACCCTAAAACCCTAACCCTAAAACCCTAAC',
				p: 16363,
				c: '101M1I49M',
				f: 83,
				g: 'none',
				g_0: 'alt'
			}
		]
	},
	{
		comment: 'Complex indel with wrong variant call (wrong indel sequence given)',
		pplink:
			pphost +
			'/?genome=hg19&block=1&bamfile=SJAML040555_D2%20WES,rpaul1/kmers/wrong_indel.bam&position=chr4:55589768-55589770&variant=chr4.55589768.CTTACGA.ACGG&bedjfilterbyname=NM_000222',
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
				n:
					'Read supports none as it contains AGGG sequence (the correct indel sequence). Here the read should be right-aligned as its softclipped to the left',
				s: 'CAGAAATCCTGAAGGGCAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTTCCAGAGGCCCCAATAGATTGGGATTTTTGCCCAGGAACTTA',
				p: 55589775,
				c: '16S82M2S',
				f: 163,
				g: 'none',
				g_0: 'alt'
			},
			{
				n:
					'Read supports none as it contains AGGG sequence (the correct indel sequence). Here the read should be right-aligned as indel is close to start position of read',
				s: 'GAAGGGCAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAGCAGAGGTGA',
				p: 55589766,
				c: '2M3D98M',
				f: 147,
				g: 'none',
				g_0: 'alt'
			},
			{
				n: 'Read supports alt as it only contains "GG" portion of AGGG',
				s: 'GGCAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGGATTTTTGTCCAGGAACTGAGCAGAGGGGAGATG',
				p: 55589773,
				c: '100M',
				f: 99,
				g: 'alt',
				g_0: 'alt'
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
				n:
					'Read supports none as it contains the AGGG correct indel sequence. The indel is closer to end-position so the read should be left-aligned',
				s: 'GAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGAAGGGCAGGCT',
				p: 55589678,
				c: '90M3D10M',
				f: 99,
				g: 'none',
				g_0: 'alt'
			}
		]
	},

	{
		comment: 'Complex indel with wrong variant call (correct indel sequence given)',
		pplink:
			pphost +
			'/?genome=hg19&block=1&bamfile=SJAML040555_D2%20WES,rpaul1/kmers/wrong_indel.bam&position=chr4:55589768-55589770&variant=chr4.55589768.CTTACGA.AGGG&bedjfilterbyname=NM_000222',
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
				n:
					'Read supports alt as it contains AGGG sequence (the correct indel sequence). Here the read should be right-aligned as its softclipped to the left',
				s: 'CAGAAATCCTGAAGGGCAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTTCCAGAGGCCCCAATAGATTGGGATTTTTGCCCAGGAACTTA',
				p: 55589775,
				c: '16S82M2S',
				f: 163,
				g: 'alt'
			},
			{
				n:
					'Read supports alt as it contains AGGG sequence (the correct indel sequence). Here the read should be right-aligned as indel is close to start position of read',
				s: 'GAAGGGCAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAGCAGAGGTGA',
				p: 55589766,
				c: '2M3D98M',
				f: 147,
				g: 'alt'
			},
			{
				n: 'Read supports alt as it only contains "GG" portion of AGGG',
				s: 'GGCAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGGATTTTTGTCCAGGAACTGAGCAGAGGGGAGATG',
				p: 55589773,
				c: '100M',
				f: 99,
				g: 'alt'
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
				n:
					'Read supports alt as it contains the AGGG correct indel sequence. The indel is closer to end-position so the read should be left-aligned',
				s: 'GAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGAAGGGCAGGCT',
				p: 55589678,
				c: '90M3D10M',
				f: 99,
				g: 'alt'
			}
		]
	}
]

// same as utils/benchmark/fisher.rust.r.js
function run_rust(binfile, input_data) {
	//console.log('input_data:', input_data)
	return new Promise((resolve, reject) => {
		const binpath = path.join('../../../server/utils/rust/target/release/', binfile)
		const ps = spawn(binpath)
		const stdout = []
		const stderr = []
		Readable.from(input_data).pipe(ps.stdin)
		ps.stdout.on('data', data => stdout.push(data))
		ps.stderr.on('data', data => stderr.push(data))
		ps.on('error', err => {
			reject(err)
		})
		ps.on('close', code => {
			if (code !== 0) reject(`spawned '${binfile}' exited with a non-zero status and this stderr:\n${stderr.join('')}`)
			//console.log('stdout:', stdout.join('').toString())
			resolve(stdout.join('').toString())
		})
	})
}
