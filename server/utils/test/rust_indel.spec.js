const tape = require('tape')
const spawn = require('child_process').spawn
const Readable = require('stream').Readable

/**************
 Code to test
***************/
const rust_indel_bin = '../rust_indel_cargo/target/release/rust_indel_cargo'

// these are constants. can be overwritten by the same settings in the examples
const kmer_length = 6,
	weight_no_indel = 0.1,
	weight_indel = 10,
	threshold_slope = 0.1,
	strictness = 1

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

function runTest(e, test) {
	// validate data structure of e
	if (!e.pplink) throw '.pplink missing'
	if (!e.leftFlank) throw '.leftFlank missing'
	if (!e.rightFlank) throw '.rightFlank missing'
	if (!e.seqRef) throw '.seqRef missing'
	if (!e.seqMut) throw '.seqMut missing'
	if (!Number.isInteger(e.readlen)) throw '.readlen is not integer'
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
		if (r.g != 'none' && r.g != 'ref' && r.g != 'alt') throw '.g (group) is not none/ref/alt for a read'
	}

	// compose input string
	const input =
		e.seqRef +
		'-' +
		e.seqMut +
		'-' +
		e.reads.map(i => i.s).join('-') +
		':' +
		e.reads.map(i => i.p).join('-') +
		':' +
		e.reads.map(i => i.c).join('-') +
		':' +
		e.variant.pos +
		':' +
		e.readlen +
		':' +
		e.variant.ref +
		':' +
		e.variant.alt +
		':' +
		kmer_length +
		':' +
		weight_no_indel +
		':' +
		weight_indel +
		':' +
		threshold_slope +
		':' +
		strictness +
		':' +
		e.leftFlank +
		':' +
		e.rightFlank

	// run rust binary
	const ps = spawn(rust_indel_bin)
	Readable.from(input).pipe(ps.stdin)
	const stdout = []
	const err = []
	ps.stderr.on('data', d => err.push(d))
	ps.stdout.on('data', data => stdout.push(data))
	ps.on('close', code => {
		const errmsg = err.join('').trim()
		if (errmsg) throw errmsg

		let groups, indices
		for (const line of stdout.join('').split('\n')) {
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

		// detect reads that fail the test
		let wrongcount = 0
		for (let i = 0; i < indices.length; i++) {
			if (e.reads[indices[i]].g != groups[i]) wrongcount++
		}
		if (wrongcount) {
			const lst = []
			for (let i = 0; i < e.reads.length; i++) {
				const truth = e.reads[i].g
				const result = groups[indices.indexOf(i)]
				lst.push(
					i + '\t\t' + truth + '\t' + (truth != result ? result + (e.reads[i].n ? ' (' + e.reads[i].n + ')' : '') : '')
				)
			}
			test.fail(`Misassigned ${wrongcount} reads: ${e.pplink}\nRead\tTruth\tResult\n${lst.join('\n')}`)
		} else {
			test.pass('All passed: ' + e.pplink)
		}
	})
}

const examples = [
	// one object for each example
	{
		// link is for display only, not computing
		pplink:
			'https://ppr.stjude.org/?genome=hg19&block=1&bamfile=test,proteinpaint_demo/hg19/bam/rna.8bp.insertion.bam&position=chr11:119155611-119155851&variant=chr11.119155746.T.TTGACCTGG',
		leftFlank: 'GTACCCTAGGTGGAACGGCCGCCTTCTCCATTCTCCATGGCCCCACAAGCTTCCCTTCCCCCGGTGCCACCACGAC',
		rightFlank: 'TGACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAGTGCTTCTGCTCTTGGAACTGCTTCTAAGGTAAAGCATTTT',
		seqRef:
			'GTACCCTAGGTGGAACGGCCGCCTTCTCCATTCTCCATGGCCCCACAAGCTTCCCTTCCCCCGGTGCCACCACGACTTGACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAGTGCTTCTGCTCTTGGAACTGCTTCTAAGGTAAAGCATTTT',
		seqMut:
			'GTACCCTAGGTGGAACGGCCGCCTTCTCCATTCTCCATGGCCCCACAAGCTTCCCTTCCCCCGGTGCCACCACGACTTGACCTGGTGACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAGTGCTTCTGCTCTTGGAACTGCTTCTAAGGTAAAGCATTTT',
		readlen: 75,
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
				g: 'alt'
			},
			{
				n: 'softclip on right',
				s: 'CTTCTCCATTCTCCATGGCCCCACAAGCTTCCCTTCCCCCGGTGCCACCACGACTTGACCTGGTGACCTTCTGCC',
				p: 119155692, // 1-based
				c: '61M14S',
				g: 'alt'
			},
			{
				n: 'softclip on right',
				s: 'CCATTCTCCATGGCCCCACAAGCTTCCCTTCCCCCGGTGCCACCACGACTTGACCTGGTGACCTTCCGCCGCAGC',
				p: 119155697,
				c: '56M19S',
				g: 'alt'
			},
			{
				n: 'insertion at right',
				s: 'TCCATTCTCCATGGCCCCACAAGCTTCCCTTCCCCCGGTGCCACCACGACTTGACCTGGTGACCTTCTGCCGCAG',
				p: 119155696,
				c: '51M8I16M',
				g: 'alt'
			},
			{
				n: 'insertion at left',
				s: 'AAGCTTCCCTTCCCCCGGTGCCACCACGACTTGACCTGGTGACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAG',
				p: 119155716,
				c: '37M8I30M',
				g: 'alt'
			},
			{
				n: 'softclip on left',
				s: 'CCACGACTTGACCTGGTGACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAGTGCTTCTGCTCTTGGAACTGCTT',
				p: 119155731,
				c: '16S59M',
				g: 'alt'
			},
			{
				n: 'softclip on left',
				s: 'CTTGACCTGGTGACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAGTGCTTCTGCTCTTGGAACTGCTTCTAAGG',
				p: 119155737,
				c: '10S65M',
				g: 'alt'
			}
			/*
			{
				n:'mismatch on left',
				s:'CCTGGTGACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAGTGCTTCTGCTCTTGGAACTGCTTCTAAGGCTGCT',
				p:119155742,
				c:'69M88N6M',
				g:'alt',
			},

			{
				n:'ref',
				s:'GAACGGCCGCCTTCTCCATTCTCCATGGCCCCACAAGCTTCCCTTCCCCCGGTGCCACCACGACTTGACCTTCTG',
				p:119155682,
				c:'75M',
				g:'ref'
			}
			*/
		]
	}
]
