/********************************************
Unit tests for initGeneDbLookups() (server/src/genedbLookups.ts)

Builds an in-memory gene db with the same table/collation shape as a real one, then checks
the map-backed getters against the sql statements they replace: every call site was written
against those statements, so parity is the requirement, not just plausible output.

Run with:
  cd proteinpaint/server && npx tsx --conditions=sjpp/dev src/test/genedbLookups.unit.spec.ts
or run the whole unit suite (as CI does):
  cd proteinpaint/server && npm run test:unit
*********************************************/
import tape from 'tape'
import Database from 'better-sqlite3'
import { initGeneDbLookups } from '../genedbLookups.ts'

/** the tables and `collate nocase` columns of a real gene db, with a few rows of hg38 */
function makeGeneDb() {
	const db = new Database(':memory:')
	db.exec(`
		create table genes (name character varying(50) collate nocase, isoform character varying(50) collate nocase,
			isdefault smallint, genemodel json);
		create table genealias (alias character varying(50) collate nocase, name character varying(50) collate nocase);
		create table gene2canonicalisoform (gene character collate nocase, isoform character collate nocase);
		insert into genes values
			('TP53', 'NM_000546', 1, '{}'),
			('TP53', 'ENST00000269305', 0, '{}'),
			('AKT1', 'NM_005163', 1, '{}'),
			('MIR1302-2HG', null, 1, '{}');
		insert into genealias values ('p53', 'TP53'), ('LFS1', 'TP53'), ('ENSG00000141510', 'TP53');
		insert into gene2canonicalisoform values ('ENSG00000012048', 'ENST00000357654');
	`)
	const genedb: any = { db }
	initGeneDbLookups(genedb, new Set(['genes', 'genealias', 'gene2canonicalisoform']))
	// the statements the getters replaced, to compare against
	const sql = {
		nameByNameOrIsoform: db.prepare('select name from genes where name=? or isoform=?'),
		nameByIsoform: db.prepare('select distinct name from genes where isoform=?'),
		nameByAlias: db.prepare('select name from genealias where alias=?'),
		aliasByName: db.prepare('select alias from genealias where name=?'),
		canonicalIsoform: db.prepare('select isoform from gene2canonicalisoform where gene=?')
	}
	return { genedb, sql }
}

tape('\n', test => {
	test.comment('-***- genedbLookups -***-')
	test.end()
})

tape('getters match the sql statements they replace', test => {
	const { genedb, sql } = makeGeneDb()
	for (const input of ['TP53', 'tp53', 'AKT1', 'MIR1302-2HG', 'NM_000546', 'ENST00000269305', 'nm_000546', 'xxx']) {
		test.deepEqual(
			genedb.getnamebynameorisoform.get(input, input),
			sql.nameByNameOrIsoform.get(input, input),
			`getnamebynameorisoform('${input}')`
		)
		test.deepEqual(genedb.getnamebyisoform.get(input), sql.nameByIsoform.get(input), `getnamebyisoform('${input}')`)
	}
	for (const input of ['p53', 'P53', 'ENSG00000141510', 'LFS1', 'xxx']) {
		test.deepEqual(genedb.getNameByAlias.get(input), sql.nameByAlias.get(input), `getNameByAlias.get('${input}')`)
		test.deepEqual(genedb.getNameByAlias.all(input), sql.nameByAlias.all(input), `getNameByAlias.all('${input}')`)
	}
	for (const input of ['TP53', 'tp53', 'AKT1', 'xxx']) {
		test.deepEqual(genedb.getAliasByName.all(input), sql.aliasByName.all(input), `getAliasByName.all('${input}')`)
	}
	for (const input of ['ENSG00000012048', 'ensg00000012048', 'xxx']) {
		test.deepEqual(
			genedb.get_gene2canonicalisoform.get(input),
			sql.canonicalIsoform.get(input),
			`get_gene2canonicalisoform('${input}')`
		)
	}
	test.end()
})

tape('the maps the request validation reads', test => {
	const { genedb } = makeGeneDb()
	test.deepEqual([...genedb.mapByName.keys()].sort(), ['AKT1', 'MIR1302-2HG', 'TP53'], 'one entry per gene name')
	test.deepEqual(
		[...genedb.mapByIsoform.keys()].sort(),
		['ENST00000269305', 'NM_000546', 'NM_005163'],
		'one entry per isoform, and a gene with no isoform adds none'
	)
	test.deepEqual([...genedb.mapByAlias.keys()].sort(), ['ENSG00000141510', 'LFS1', 'P53'], 'aliases, keyed uppercase')
	test.deepEqual(genedb.mapAliasesByName.get('TP53'), ['p53', 'LFS1', 'ENSG00000141510'], 'aliases of a gene')
	test.equal(genedb.mapCanonicalIsoformByEnsg.get('ENSG00000012048'), 'ENST00000357654', 'canonical isoform')
	test.equal(genedb.mapByIsoform.get('NM_000546'), genedb.mapByName.get('TP53'), 'a repeated name is held once')
	test.end()
})

tape('a gene db without the optional tables', test => {
	const db = new Database(':memory:')
	db.exec(`create table genes (name character collate nocase, isoform character collate nocase);
		insert into genes values ('TP53', 'NM_000546');`)
	const genedb: any = { db }
	initGeneDbLookups(genedb, new Set(['genes']))
	test.deepEqual(genedb.getnamebynameorisoform.get('TP53', 'TP53'), { name: 'TP53' }, 'the genes table still loads')
	test.equal(genedb.getNameByAlias, undefined, 'no alias getter without a genealias table')
	test.equal(genedb.getAliasByName, undefined, 'no alias getter without a genealias table')
	test.equal(genedb.get_gene2canonicalisoform, undefined, 'no getter without a gene2canonicalisoform table')
	test.equal(genedb.mapByAlias, undefined, 'and no map for either')
	test.end()
})

tape('a non-string lookup is a miss, not a throw', test => {
	const { genedb } = makeGeneDb()
	for (const input of [undefined, null, 5, {}] as any[]) {
		test.equal(genedb.getnamebynameorisoform.get(input, input), undefined, `getnamebynameorisoform(${input})`)
		test.equal(genedb.getnamebyisoform.get(input), undefined, `getnamebyisoform(${input})`)
		test.equal(genedb.getNameByAlias.get(input), undefined, `getNameByAlias(${input})`)
		test.deepEqual(genedb.getAliasByName.all(input), [], `getAliasByName.all(${input})`)
		test.equal(genedb.get_gene2canonicalisoform.get(input), undefined, `get_gene2canonicalisoform(${input})`)
	}
	test.end()
})
