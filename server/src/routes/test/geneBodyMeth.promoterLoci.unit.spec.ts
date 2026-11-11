import tape from 'tape'
import { promoterLoci, PROMOTER_UP, PROMOTER_DOWN } from '../termdb.geneBodyMeth.ts'
import { GENE_BODY_PAD } from '#src/utils/dmrGenes.ts'

/*
Tests:
	core promoter on each strand, first default isoform per symbol, clipped at 0
*/

tape('\n', test => {
	test.comment('-***- routes/termdb.geneBodyMeth promoterLoci -***-')
	test.end()
})

tape('core promoter on each strand', test => {
	const row = (name: string, chr: string, start: number, stop: number, strand: string) => ({
		name,
		genemodel: JSON.stringify({ chr, start, stop, strand })
	})
	const loci = promoterLoci([
		row('PLUS', 'chr1', 10000, 50000, '+'),
		row('MINUS', 'chr2', 10000, 50000, '-'),
		// a second default row for a symbol is ignored
		row('PLUS', 'chr9', 1, 2, '+'),
		row('EDGE', 'chr3', 100, 5000, '+')
	])
	test.deepEqual(
		loci.get('PLUS'),
		{ chr: 'chr1', start: 8000, stop: 10500 },
		'should end 500 bp into a plus-strand gene'
	)
	test.deepEqual(loci.get('MINUS'), { chr: 'chr2', start: 49500, stop: 52000 }, 'should mirror on the minus strand')
	test.deepEqual(loci.get('EDGE'), { chr: 'chr3', start: 0, stop: 600 }, 'should clip at the chromosome start')
	test.ok(PROMOTER_DOWN < GENE_BODY_PAD && PROMOTER_UP > 0, 'should end before the gene body starts')
	// a symbol whose first row is on a contig: with the chromosomes to keep, the first row on one of them
	const rows = [row('ALT', 'chr1_alt', 100000, 200000, '+'), row('ALT', 'chr5', 30000, 40000, '+')]
	test.equal(promoterLoci(rows).get('ALT')?.chr, 'chr1_alt', 'should keep the first row without chromosomes to keep')
	test.deepEqual(
		promoterLoci(rows, new Set(['chr5'])).get('ALT'),
		{ chr: 'chr5', start: 28000, stop: 30500 },
		'should skip rows on other chromosomes'
	)
	test.end()
})
