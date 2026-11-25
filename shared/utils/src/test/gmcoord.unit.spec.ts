import tape from 'tape'
import { genomic2gm, aa2gmcoord, rna2gmcoord } from '../gmcoord.js'

/* test sections

genomic2gm()
	forward strand
	reverse strand
	tempoff
aa2gmcoord()
rna2gmcoord()
*/

/* two exons of 100bp with an intron between them, a 50bp 5' UTR, a 90bp coding region
(30 codons) split across both exons, and a 60bp 3' UTR on the forward strand */
const fwd = {
	strand: '+',
	start: 100,
	stop: 400,
	rnalen: 200,
	exon: [
		[100, 200],
		[300, 400]
	],
	coding: [
		[150, 200],
		[300, 340]
	],
	codingstart: 150,
	codingstop: 340,
	cdslen: 90,
	utr5: [[100, 150]],
	utr3: [[340, 400]]
}

/* same layout on the reverse strand: the 5' end is at the right, so the 60bp UTR is the 5' UTR,
and lists are 5' to 3' */
const rev = {
	strand: '-',
	start: 100,
	stop: 400,
	rnalen: 200,
	exon: [
		[300, 400],
		[100, 200]
	],
	coding: [
		[300, 340],
		[150, 200]
	],
	codingstart: 150,
	codingstop: 340,
	cdslen: 90,
	utr5: [[340, 400]],
	utr3: [[100, 150]]
}

const noncoding = { strand: '+', start: 100, stop: 400, rnalen: 200, exon: fwd.exon }

tape('\n', function (test) {
	test.comment('-***- gmcoord specs -***-')
	test.end()
})

tape('genomic2gm() forward strand', test => {
	test.deepEqual(genomic2gm(50, fwd), { atupstream: { off: 50 }, rnapos: 0, aapos: 0 }, 'should be upstream')
	test.deepEqual(genomic2gm(400, fwd), { atdownstream: { off: 1 }, rnapos: 200, aapos: 30 }, 'should be downstream')
	test.deepEqual(
		genomic2gm(120, fwd),
		{ atexon: 1, rnapos: 21, aapos: 0, atutr5: { total: 50, off: 20 } },
		'should be in the 5 prime UTR'
	)
	test.deepEqual(genomic2gm(150, fwd), { atexon: 1, rnapos: 51, aapos: 1 }, 'should be the first codon')
	test.deepEqual(genomic2gm(160, fwd), { atexon: 1, rnapos: 61, aapos: 4 }, 'should be in the coding region')
	test.deepEqual(
		genomic2gm(250, fwd),
		{ atexon: 2, atintron: 1, rnapos: 100.5, aapos: 17 },
		'should be in the intron, with a .5 rnapos'
	)
	test.deepEqual(
		genomic2gm(350, fwd),
		{ atexon: 2, rnapos: 151, aapos: 30, atutr3: { total: 60, off: 10 } },
		'should be in the 3 prime UTR'
	)
	test.deepEqual(genomic2gm(250, noncoding), { atexon: 2, atintron: 1, rnapos: 100.5 }, 'should not have aapos')
	test.end()
})

tape('genomic2gm() reverse strand', test => {
	test.deepEqual(genomic2gm(50, rev), { atdownstream: { off: 50 }, rnapos: 200, aapos: 30 }, 'should be downstream')
	test.deepEqual(genomic2gm(400, rev), { atupstream: { off: 1 }, rnapos: 0, aapos: 0 }, 'should be upstream')
	test.deepEqual(
		genomic2gm(380, rev),
		{ atexon: 1, rnapos: 20, aapos: 0, atutr5: { total: 60, off: 20 } },
		'should be in the 5 prime UTR'
	)
	test.deepEqual(genomic2gm(320, rev), { atexon: 1, rnapos: 80, aapos: 7 }, 'should be in the coding region')
	test.deepEqual(
		genomic2gm(250, rev),
		{ atexon: 2, atintron: 1, rnapos: 100.5, aapos: 14 },
		'should be in the intron, with a .5 rnapos'
	)
	test.deepEqual(
		genomic2gm(120, rev),
		{ atexon: 2, rnapos: 180, aapos: 30, atutr3: { total: 50, off: 30 } },
		'should be in the 3 prime UTR'
	)
	test.end()
})

tape('genomic2gm() tempoff', test => {
	test.deepEqual(genomic2gm(203, fwd).atintron, 1, 'should be in the intron without tempoff')
	const t = genomic2gm(203, fwd, 5)
	test.equal(t.atexon, 1, 'should count a position near an exon as in the exon with tempoff')
	test.equal(t.atintron, undefined, 'should not be in the intron with tempoff')
	test.end()
})

tape('aa2gmcoord()', test => {
	test.equal(aa2gmcoord(1, fwd), 150, 'should map codon 1 to the coding start on the forward strand')
	test.equal(aa2gmcoord(17, fwd), 198, 'should map a codon in the first coding exon on the forward strand')
	test.equal(aa2gmcoord(18, fwd), 301, 'should map a codon in the second coding exon on the forward strand')
	test.equal(aa2gmcoord(1000, fwd), 340, 'should map a codon past the end to codingstop on the forward strand')
	test.equal(aa2gmcoord(1, rev), 339, 'should map codon 1 to the coding stop on the reverse strand')
	test.equal(aa2gmcoord(15, rev), 197, 'should map a codon in the second coding exon on the reverse strand')
	test.equal(aa2gmcoord(1000, rev), 150, 'should map a codon past the end to codingstart on the reverse strand')
	test.equal(aa2gmcoord(1.5, fwd), null, 'should return null for a non-integer codon')
	test.equal(aa2gmcoord(1, noncoding), null, 'should return null for a noncoding isoform')
	test.end()
})

tape('rna2gmcoord()', test => {
	test.equal(rna2gmcoord(10, fwd), 110, 'should map into the first exon on the forward strand')
	test.equal(rna2gmcoord(150, fwd), 350, 'should map into the second exon on the forward strand')
	test.equal(rna2gmcoord(500, fwd), 400, 'should map past the end to stop on the forward strand')
	test.equal(rna2gmcoord(10, rev), 389, 'should map into the first exon on the reverse strand')
	test.equal(rna2gmcoord(150, rev), 149, 'should map into the second exon on the reverse strand')
	test.equal(rna2gmcoord(500, rev), 100, 'should map past the end to start on the reverse strand')
	test.equal(rna2gmcoord(NaN, fwd), null, 'should return null for a non-numeric position')
	test.equal(rna2gmcoord(10, { strand: '+' }), null, 'should return null without exons')
	test.end()
})
