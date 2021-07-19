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
		if (!r.seq) throw '.seq missing from a read'
		if (!Number.isInteger(r.pos)) throw '.pos not integer from a read'
		if (!r.cigar) throw '.cigar missing from a read'
		if (r.group != 'none' && r.group != 'ref' && r.group != 'alt') throw '.group is not none/ref/alt for a read'
	}

	// compose input string
	const input =
		e.seqRef +
		'-' +
		e.seqMut +
		'-' +
		e.reads.map(i => i.seq).join('-') +
		':' +
		e.reads.map(i => i.pos).join('-') +
		':' +
		e.reads.map(i => i.cigar).join('-') +
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
		for (const idx of indices) {
			if (e.reads[idx].group != groups[idx]) {
				test.fail(`Read #${idx + 1} assigned to "${e.reads[idx].group}", should be "${groups[idx]}". ${e.pplink}`)
			}
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
				// softclip on right
				seq: 'CTTCTCCATTCTCCATGGCCCCACAAGCTTCCCTTCCCCCGGTGCCACCACGACTTGACCTGGTGACCTTCTGCC',
				pos: 119155692,
				cigar: '61M14S',
				group: 'alt'
			},
			{
				seq: 'CACGACTTGACCTGGCGACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAGTGCTTCTGCTCTTGGAACTGCTTC',
				pos: 119155749,
				cigar: '62M88N13M',
				group: 'none'
			},
			{
				seq: 'TGCCGCAGCGAGTATGTGTTCCCTCAAGTGCTTCTGCTCTTGGAACTGCTTCTAAGGTAAAGCATTTTCCATTAC',
				pos: 119155755,
				cigar: '3M8834N72M',
				group: 'ref'
			},
			{
				seq: 'GTAATCTCAGCTACTTGGGAGGCTGAGGCAGGAGAATTGCTTCAACACAAGAGGCGGAGGTTGCAGTCAGTCGAG',
				pos: 119146842,
				cigar: '3M8834N72M',
				group: 'none'
			},
			{
				seq: 'CCTGGTGACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAGTGCTTCTGCTCTTGGAACTGCTTCTAAGGCTGCT',
				pos: 119155742,
				cigar: '69M88N6M',
				group: 'none'
			},
			{
				seq: 'CCACGACTTGACCTGGTGACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAGTGCTTCTGCTCTTGGAACTGCTT',
				pos: 119155747,
				cigar: '16S59M',
				group: 'alt'
			},
			{
				seq: 'CTTGACCTGGTGACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAGTGCTTCTGCTCTTGGAACTGCTTCTAAGG',
				pos: 119155747,
				cigar: '10S65M',
				group: 'alt'
			}
		]
	}
]
