import { connect_db } from '../utils'
import { server_init_db_queries, listDbTables } from '../termdb.server.init'

/**
 * Initialize the connections and prepared statements for a genome's db files
 *
 * @param g a genome object loaded from a genome js file
 * @param features the experimental serverconfig.features object
 */
export function initdb(g, features = {}) {
	if (!g.genomicNameRegexp) g.genomicNameRegexp = /[^a-zA-Z0-9.:_-]/
	if (g.genedb) {
		if (!g.genedb.dbfile) throw genomename + ': .genedb.dbfile missing'
		// keep reference of the connection (.db) so as to add dataset-specific query statements later
		try {
			console.log('Connecting', g.genedb.dbfile)
			g.genedb.db = connect_db(g.genedb.dbfile)
		} catch (e) {
			throw `Cannot connect genedb: ${g.genedb.dbfile}: ${e}`
		}
		g.genedb.getnamebynameorisoform = g.genedb.db.prepare('select name from genes where name=? or isoform=?')
		g.genedb.getnamebyisoform = g.genedb.db.prepare('select distinct name from genes where isoform=?')
		g.genedb.getjsonbyname = g.genedb.db.prepare('select isdefault,genemodel from genes where name=?')
		g.genedb.getjsonbyisoform = g.genedb.db.prepare('select isdefault,genemodel from genes where isoform=?')
		g.genedb.getnameslike = g.genedb.db.prepare('select distinct name from genes where name like ? limit 20')

		/*
		optional tables in gene db:

		- genealias
		- gene2coord
		- ideogram
		- gene2canonicalisoform
		- refseq2ensembl
		- buildDate

		if present, create getter to this table and attach to g.genedb{}
		*/
		const tables = listDbTables(g.genedb.db)
		if (tables.has('genealias')) {
			g.genedb.getNameByAlias = g.genedb.db.prepare('select name from genealias where alias=?')
			g.genedb.tableSize = g.genedb.db.prepare('select count(*) from genealias where alias=?')
		}
		if (tables.has('gene2coord')) {
			g.genedb.getCoordByGene = g.genedb.db.prepare('select * from gene2coord where name=?')
		}
		if (tables.has('ideogram')) {
			g.genedb.hasIdeogram = true
			g.genedb.getIdeogramByChr = g.genedb.db.prepare('select * from ideogram where chromosome=?')
		} else {
			g.genedb.hasIdeogram = false
		}
		if (tables.has('gene2canonicalisoform')) {
			g.genedb.get_gene2canonicalisoform = g.genedb.db.prepare('select isoform from gene2canonicalisoform where gene=?')
		}
		if (tables.has('buildDate')) {
			g.genedb.get_buildDate = g.genedb.db.prepare('select date from buildDate')
		}

		// this table is only used for gdc dataset
		g.genedb.hasTable_refseq2ensembl = tables.has('refseq2ensembl')

		g.genedb.sqlTables = [...tables]
		g.genedb.tableSize = {}
		for (const table of tables) {
			if (table == 'buildDate') continue
			g.genedb.tableSize[table] = g.genedb.db.prepare(`select count(*) as size from ${table}`).get().size
		}
	}

	// termdbs{} is optional
	if (g.termdbs) {
		for (const key in g.termdbs) {
			server_init_db_queries(g.termdbs[key], features)
			console.log(`${key} initiated as ${genomename}-level termdb`)
		}
	}
}
