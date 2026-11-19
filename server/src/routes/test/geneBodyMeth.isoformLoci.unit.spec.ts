import tape from 'tape'
import Database from 'better-sqlite3'
import { guardDb } from '#src/sql.ts'
import { isoformLoci, isoformRows, PROMOTER_UP, PROMOTER_DOWN } from '../termdb.geneBodyMeth.ts'
import { GENE_BODY_PAD } from '#src/utils/dmrGenes.ts'

/*
isoformLoci(): each transcript's own core promoter or body, for the starburst by isoform
- the promoter window around the transcript's own TSS, by strand
- the body trimmed as a gene body is, none when too short
- only the transcripts asked for, on the chromosomes given
isoformRows(): only the asked-for rows of the genes table, across batches
*/

const model = (isoform: string, chr: string, start: number, stop: number, strand: string) => ({
	isoform,
	genemodel: JSON.stringify({ chr, start, stop, strand })
})
const rows = [
	model('ENST1', 'chr1', 100000, 150000, '+'),
	// a second transcript of the same gene, starting downstream: its own promoter
	model('ENST2', 'chr1', 120000, 150000, '+'),
	model('ENST3', 'chr1', 300000, 340000, '-'),
	model('ENST4', 'chr1', 500000, 500000 + GENE_BODY_PAD, '+'),
	model('ENST5', 'chrUn', 1, 50000, '+')
]

tape('\n', test => {
	test.comment('-***- termdb.geneBodyMeth isoformLoci -***-')
	test.end()
})

tape('isoformLoci() promoters follow each transcript', test => {
	const p = isoformLoci(rows, new Set(['ENST1', 'ENST2', 'ENST3']), 'promoter')
	test.deepEqual(
		p.get('ENST1'),
		{ chr: 'chr1', start: 100000 - PROMOTER_UP, stop: 100000 + PROMOTER_DOWN },
		'plus strand: around start'
	)
	test.deepEqual(
		p.get('ENST2'),
		{ chr: 'chr1', start: 120000 - PROMOTER_UP, stop: 120000 + PROMOTER_DOWN },
		'an alternative TSS is its own promoter'
	)
	test.deepEqual(
		p.get('ENST3'),
		{ chr: 'chr1', start: 340000 - PROMOTER_DOWN, stop: 340000 + PROMOTER_UP },
		'minus strand: around stop'
	)
	test.end()
})

tape('isoformLoci() bodies are trimmed, and only the asked-for transcripts on the given chromosomes', test => {
	const b = isoformLoci(rows, new Set(['ENST1', 'ENST4', 'ENST5']), undefined, new Set(['chr1']))
	test.deepEqual(
		b.get('ENST1'),
		{ chr: 'chr1', start: 100000 + GENE_BODY_PAD, stop: 150000 - GENE_BODY_PAD },
		'trimmed body'
	)
	test.notOk(b.has('ENST4'), 'a body shorter than twice the pad has no locus')
	test.notOk(b.has('ENST5'), 'a transcript off the chromosomes is left out')
	test.notOk(b.has('ENST2'), 'a transcript not asked for is left out')
	test.end()
})

tape('isoformRows() reads only the transcripts asked for, across batches', test => {
	const db = guardDb(new Database(':memory:'))
	db.exec('create table genes (name text, isoform text collate nocase, isdefault int, genemodel json)')
	const insert = db.prepare('insert into genes values (?, ?, 0, ?)')
	for (let i = 0; i < 1200; i++) insert.run('G', `ENST${i}`, '{}')
	// 1100 ids: two full batches and a short one, with a repeat and one the table does not have
	const ids = [...Array.from({ length: 1099 }, (_, i) => `ENST${i}`), 'ENST0', 'ENST9999']
	const rows = isoformRows(db, ids)
	test.equal(rows.length, 1099, 'one row per known transcript asked for')
	test.notOk(
		rows.some(r => r.isoform == 'ENST1100'),
		'a transcript not asked for is not read'
	)
	db.close()
	test.end()
})
