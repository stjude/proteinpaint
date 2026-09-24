/********************************************
Unit tests for the chat pipeline's db parsers, which read from the connections that the server
already holds (genome.genedb.db and ds.cohort.db.connection) instead of opening their own.

The parsers are run against the test termdb and genedb, opened with connect_db() in sqlCheck='throw'
mode like the server does, so a query with quoted values would fail here. Expected values are read
directly from the same dbs, and the connection must still be open after parsing since it is shared.

Run with:
  cd proteinpaint/server && npx tsx --conditions=sjpp/dev src/test/chat.db.unit.spec.ts
or run the whole unit suite (as CI does):
  cd proteinpaint/server && npm run test:unit
*********************************************/
import tape from 'tape'
import path from 'path'
import { connect_db } from '../sql.ts'
import { parse_geneset_db, parse_dataset_db, parse_survival_terms_from_db } from '../chat/utils.ts'
import { parse_dataset_db as parse_dataset_db_withNames } from '../chat/entity2termObj.ts'
import { isMsgToUser } from '../chat/scaffoldTypes.ts'

const tpdir = path.join(import.meta.dirname, '../../test/tp')
const termdb = connect_db(path.join(tpdir, 'files/hg38/TermdbTest/db'), { sqlCheck: 'throw' })
const genedb = connect_db(path.join(tpdir, 'anno/genes.hg38.test.db'), { sqlCheck: 'throw' })

// rows are sorted in js on both sides of a comparison, since sqlite and js sort strings differently
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

// the terms that have a termhtmldef entry, which the dictionary parsers join on
const dictTerms = (
	termdb.prepare('SELECT t.id, t.name FROM terms t INNER JOIN termhtmldef h ON t.id = h.id').all() as {
		id: string
		name: string
	}[]
).sort(byId)

tape('\n', t => {
	t.comment('-***- chat db parser specs -***-')
	t.end()
})

tape('parse_geneset_db()', async t => {
	const expected = (genedb.prepare('SELECT name FROM codingGenes').all() as { name: string }[]).map(r =>
		r.name.toLowerCase()
	)
	const genes = await parse_geneset_db(genedb)
	t.ok(expected.length > 0, 'should have coding genes in the test genedb')
	t.deepEqual(genes, expected, 'should return the lowercased names of all coding genes')
	t.ok(genedb.open, 'should not close the shared genedb connection')
	t.end()
})

tape('parse_dataset_db() in chat/utils.ts', async t => {
	const result = await parse_dataset_db(termdb)
	if (isMsgToUser(result)) {
		t.fail('should not return a message to the user: ' + result.text)
		return t.end()
	}
	t.ok(dictTerms.length > 0, 'should have dictionary terms in the test termdb')
	t.deepEqual(
		result.db_rows.map(r => r.name).sort(),
		dictTerms.map(r => r.id),
		'should return one row per dictionary term, with the term id as the name'
	)
	t.equal(result.rag_docs.length, result.db_rows.length, 'should return one rag doc per row')
	t.ok(termdb.open, 'should not close the shared termdb connection')
	t.end()
})

tape('parse_dataset_db() in chat/entity2termObj.ts', async t => {
	const result = await parse_dataset_db_withNames(termdb)
	if (isMsgToUser(result)) {
		t.fail('should not return a message to the user: ' + result.text)
		return t.end()
	}
	t.deepEqual(
		result.db_rows.map(r => ({ id: r.id, name: r.name })).sort(byId),
		dictTerms,
		'should return one row per dictionary term, with the term id and the term name'
	)
	t.equal(result.rag_docs.length, result.db_rows.length, 'should return one rag doc per row')
	t.ok(termdb.open, 'should not close the shared termdb connection')
	t.end()
})

tape('parse_survival_terms_from_db()', async t => {
	const expected = (termdb.prepare('SELECT id FROM terms WHERE type = ?').all('survival') as any[])
		.map(r => r.id)
		.sort()
	const result = await parse_survival_terms_from_db(termdb)
	t.ok(expected.length > 0, 'should have survival terms in the test termdb')
	t.deepEqual(result.db_rows.map(r => r.name).sort(), expected, 'should return only the survival terms')
	t.equal(result.rag_docs.length, result.db_rows.length, 'should return one rag doc per row')
	t.ok(termdb.open, 'should not close the shared termdb connection')
	t.end()
})

tape('repeated parsing with the shared connections', async t => {
	const first = await parse_dataset_db(termdb)
	const second = await parse_dataset_db(termdb)
	t.deepEqual(second, first, 'should return the same result when called again on the same connection')
	t.equal((await parse_geneset_db(genedb)).length, (await parse_geneset_db(genedb)).length, 'should reuse the genedb')
	t.end()
})

tape('cleanup', t => {
	termdb.close()
	genedb.close()
	t.end()
})
