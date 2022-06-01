const tape = require('tape')
const path = require('path')
const spawn = require('child_process').spawn
const Readable = require('stream').Readable
//const utils = require('../../src/utils')

/*
to compile rust, see server/utils/rust/README.md

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

const strictness = 1,
	groupkeys = ['ref', 'alt', 'none', 'amb'] // corresponds to the same values returned by rust

/**************
 Test sections
***************/
tape('\n', function(test) {
	test.pass('-***- rust indel specs -***-')
	test.end()
})

tape('rust indel binary', async function(test) {
	for (const e of examples) {
		await runTest(e, test)
	}
	test.end()
})

async function runTest(e, test) {
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
		e.variant.pos +
		'_' +
		e.variant.ref +
		'_' +
		e.variant.alt +
		'_' +
		strictness +
		'_' +
		e.leftFlank +
		'_' +
		e.rightFlank

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
			if (e.reads[i].g != results[i]) wrongcount++
		}
		if (wrongcount) {
			const lst = []
			for (let i = 0; i < e.reads.length; i++) {
				const truth = e.reads[i].g
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
				g: 'none'
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
				g: 'none'
			},
			{
				s: 'GATTAGAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTAC',
				p: 55589673,
				c: '100M',
				f: 99,
				g: 'amb'
			}
		]
	}
]

// same as utils/benchmark/fisher.rust.r.js
function run_rust(binfile, input_data) {
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
			//console.log("stdout:",stdout)
			resolve(stdout.join('').toString())
		})
	})
}
