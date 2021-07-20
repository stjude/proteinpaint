const tape = require('tape')
const spawn = require('child_process').spawn
const Readable = require('stream').Readable

/**************
examples data structure
[
	{
	pplink: <provide the pplink of this example for manual inspection>
	leftFlank
	rightFlank
	seqRef <reference seq>
	seqMut <mutated seq>
	readlen <read length>
	variant {
		pos <0-based!!!>
		ref
		alt
	}
	reads [
		{
		n <optional comment on what this read is about>
		s <read sequence>
		p <1-based alignment position from BAM file>
		c <cigar>
		g <truth, ref/alt/none>
		}
	]
	}
]
***************/
const rust_indel_bin = '../rust_indel_cargo/target/release/rust_indel_cargo'
const pphost = 'http://pp-int-test.stjude.org/' // show links using this host

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
	test.pass('Testing ' + e.pplink)

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
	return new Promise((resolve, reject) => {
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
			if (groups.length != indices.length) test.fail('output_cat and output_gID are of different length')
			if (indices.length != e.reads.length)
				test.fail('Expecting ' + e.reads.length + ' reads but got ' + indices.length)
			const results = [] // in the same order as e.reads[]
			for (let i = 0; i < indices.length; i++) results[indices[i]] = groups[i]

			// detect reads that fail the test
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
						i +
							'\t\t' +
							truth +
							'\t' +
							(truth != result ? result + (e.reads[i].n ? ' (' + e.reads[i].n + ')' : '') : '')
					)
				}
				test.fail(`Misassigned ${wrongcount} reads:\nRead\tTruth\tResult\n${lst.join('\n')}`)
			} else {
				test.pass('All passed')
			}

			resolve() // this is necessary to end the test in the async call
		})
	})
}

const examples = [
	// one object for each example
	{
		// 8-bp insertion at CBL exon 10
		pplink:
			pphost +
			'?genome=hg19&block=1&bamfile=test,proteinpaint_demo/hg19/bam/rna.8bp.insertion.bam&position=chr11:119155611-119155851&variant=chr11.119155746.T.TTGACCTGG',
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
			},
			{
				n: 'ref',
				s: 'GAACGGCCGCCTTCTCCATTCTCCATGGCCCCACAAGCTTCCCTTCCCCCGGTGCCACCACGACTTGACCTTCTG',
				p: 119155682,
				c: '75M',
				g: 'ref'
			}
			/* adding these reads will break the test
			{
				n:'mismatch on left',
				s:'CCTGGTGACCTTCTGCCGCAGCGAGTATGTGTTCCCTCAAGTGCTTCTGCTCTTGGAACTGCTTCTAAGGCTGCT',
				p:119155742,
				c:'69M88N6M',
				g:'alt',
			},

			*/
		]
	},
	{
		// 3-bp deletion in KIT exon 8
		pplink:
			pphost +
			'?genome=hg19&block=1&position=chr4:55589607-55590007&bamfile=Test,proteinpaint_demo/hg19/bam/kit.exon8.del.bam&variant=chr4.55589771.ACGA.A',
		seqRef:
			'AGGGATTAGAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACGACAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAGCAGAGGTGAGATGATT',
		seqMut:
			'AGGGATTAGAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAGCAGAGGTGAGATGATT',
		leftFlank: 'AGGGATTAGAGAGGGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTT',
		rightFlank: 'CAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAGCAGAGGTGAGATGATT',
		readlen: 100,
		variant: {
			pos: 55589770,
			ref: 'ACGA',
			alt: 'A'
		},
		reads: [
			{
				n: 'softclip',
				s: 'TTTCCAGCACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACAGGCTCGTGGAAGGCATGCTCCCATGTGTGGCAGG',
				p: 55589708,
				c: '61M39S',
				g: 'alt'
			},
			{
				n: 'softclip',
				s: 'TGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACAGGCTCCTGAATGGCATGCTCCAAAGTGTGGCAGGAGGAAGACCAGAGCCCCCA',
				p: 55589727,
				c: '30M70S',
				g: 'alt'
			},
			{
				n: 'softclip',
				s: 'GCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACAGGCTCGTGAATGGCATGCTCCAAAGTGTGGCAGGAGGGTTTCCCGAGGCCCCAAA',
				p: 55589729,
				c: '44M56S',
				g: 'alt'
			},
			{
				n: 'del',
				s: 'AGAAATCCTGACTTACAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGGAGGGTTCCCCGAGCCCCCAATAGATTGGGATTTTTGTCCAGGGACTGAG',
				p: 55589757,
				c: '14M3D40M46S',
				g: 'alt'
			},
			{
				n: 'del',
				s: 'AGAAATCCTGACTTACAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAG',
				p: 55589757,
				c: '14M3D86M',
				g: 'alt'
			},
			{
				n: 'del',
				s: 'TGACTTACAGGCTCGTGAATGGCATGCTCCAATGTGTGGCAGCAGGATTCCCAGAGCCCACAATAGATTGGTATTTTTGTCCAGGAACTGAGCAGAGGTG',
				p: 55589765,
				c: '6M3D94M',
				g: 'alt'
			},
			{
				n: 'distal SNV',
				s: 'GGAGTGAAGTGAATGTTGCTGAGGTTTTCCAGCACTCTGACATATGGCCATTTCGGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTACGACAGGCTCG',
				p: 55589683,
				c: '100M',
				g: 'ref'
			},
			{
				n: 'SNV at first bp of deletion site',
				s: 'CACTCTGACATATGGCCATTTCTGTTTTCCTGTAGCAAAACCAGAAATCCTGACTTGCGACAGGCTCGTGAATGGCATGCTCCCATGTGTGGCCGCAGGG',
				p: 55589715,
				c: '100M',
				g: 'none'
			}
		]
	}
]
