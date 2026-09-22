/*******************************************************************************
In-memory lookups over a genome's gene db name/alias/isoform tables, built once
at server init (see initGenomesDs.js) and read from there on.

WHY
Every request is validated against these names before it can query data
(geneRefValidation.ts), and that check must not touch sqlite: better-sqlite3 is
synchronous, so each statement blocks the event loop for the whole process. A
name lookup is a Map hit instead, and a request naming 2000 genes costs 2000 Map
hits rather than 2000 blocking queries. It also removes the need to remember
what a client asked for: nothing is cached per request, so no sequence of
made-up names can grow the server's memory.

WHAT IS LOADED
Only the columns that map one identifier to another: gene name, alias, isoform
accession, and the canonical isoform of a gene. The genemodel json of each
isoform is by far the largest column of the db and is never needed for a name
lookup, so it stays in sqlite (getjsonbyname/getjsonbyisoform), as do the
prefix search (getnameslike) and the coord/ideogram tables.

For hg38 (517k gene rows, 81.5k symbols, 505k isoforms, 143k aliases) this
loads in ~1s and holds ~40MB. Strings that repeat across rows -- a gene name
appears once per isoform -- are interned so the maps hold one copy of each.

THE GETTERS DO NOT CHANGE SHAPE
getnamebynameorisoform, getnamebyisoform, getNameByAlias, getAliasByName and
get_gene2canonicalisoform keep the { get(), all() } shape and row objects of the
prepared statements they replace, so every call site is untouched. The maps they
read are also exposed on genedb for callers that only need existence, which is
what the request validation does.

Lookups are case-insensitive, matching the `collate nocase` of every column
these tables index on.
*******************************************************************************/

/** a row of the genes table, minus the genemodel json */
type GeneRow = { name: string; isoform: string | null }
type AliasRow = { alias: string; name: string }
type CanonicalIsoformRow = { gene: string; isoform: string }

/** keys are uppercased; a string with no lowercase letter is used as-is, which for
 * accessions (NM_000546, ENST00000269305, ENSG00000141510) is nearly all of them and
 * avoids allocating a second copy of every key. Halves the memory of the built maps */
const hasLowerCase = /[a-z]/
function upper(value: string): string {
	return hasLowerCase.test(value) ? value.toUpperCase() : value
}

/* An alias maps to one gene name far more often than to several, and a gene likewise to one
alias, so the value is the string itself and becomes an array only for the rare key that
repeats. Over the 145k aliases of hg38 this is ~25MB less than an array per key. */
type MapValue = string | string[]

function addValue(map: Map<string, MapValue>, key: string, value: string) {
	const held = map.get(key)
	if (held === undefined) map.set(key, value)
	else if (typeof held == 'string') map.set(key, [held, value])
	else held.push(value)
}

/** the row a `select ... where <col>=?` .get() would have returned, i.e. the first match */
function firstValue(map: Map<string, MapValue>, key: unknown): string | undefined {
	if (typeof key != 'string') return
	const held = map.get(upper(key))
	return typeof held == 'string' ? held : held?.[0]
}

/** every match, as .all() would have returned them, in insertion order */
function allValues(map: Map<string, MapValue>, key: unknown): string[] {
	if (typeof key != 'string') return []
	const held = map.get(upper(key))
	if (held === undefined) return []
	return typeof held == 'string' ? [held] : held
}

export function initGeneDbLookups(genedb: any, tables: Set<string>): void {
	const t0 = Date.now()

	/* one copy of each distinct string, so that a gene name repeated over its isoform rows
	is held once rather than once per row */
	const pool = new Map<string, string>()
	const intern = (value: string) => {
		const held = pool.get(value)
		if (held !== undefined) return held
		pool.set(value, value)
		return value
	}

	/** k: uppercased gene name, v: the name as stored, which is what the sql getters returned */
	const mapByName = new Map<string, string>()
	/** k: uppercased isoform accession, v: the gene name it belongs to */
	const mapByIsoform = new Map<string, string>()
	for (const row of genedb.db.prepare('select name, isoform from genes').iterate() as Iterable<GeneRow>) {
		const name = intern(row.name)
		const nameKey = upper(row.name)
		// first row wins, as `select ... limit 1` on an unordered table effectively did
		if (!mapByName.has(nameKey)) mapByName.set(nameKey, name)
		if (row.isoform) {
			const isoformKey = upper(row.isoform)
			if (!mapByIsoform.has(isoformKey)) mapByIsoform.set(isoformKey, name)
		}
	}
	genedb.mapByName = mapByName
	genedb.mapByIsoform = mapByIsoform

	genedb.getnamebynameorisoform = {
		// replaces: select name from genes where name=? or isoform=?
		get: (name: string, isoform: string) => {
			const byName = typeof name == 'string' ? mapByName.get(upper(name)) : undefined
			if (byName) return { name: byName }
			const byIsoform = typeof isoform == 'string' ? mapByIsoform.get(upper(isoform)) : undefined
			return byIsoform ? { name: byIsoform } : undefined
		}
	}
	genedb.getnamebyisoform = {
		// replaces: select distinct name from genes where isoform=?
		get: (isoform: string) => {
			const name = typeof isoform == 'string' ? mapByIsoform.get(upper(isoform)) : undefined
			return name ? { name } : undefined
		}
	}

	let aliasCount = 0
	if (tables.has('genealias')) {
		/** k: uppercased alias, v: the gene name(s) it maps to */
		const mapByAlias = new Map<string, MapValue>()
		/** k: uppercased gene name, v: its alias(es), e.g. the ENSG accession gdc queries with */
		const mapAliasesByName = new Map<string, MapValue>()
		for (const row of genedb.db.prepare('select alias, name from genealias').iterate() as Iterable<AliasRow>) {
			aliasCount++
			addValue(mapByAlias, upper(row.alias), intern(row.name))
			addValue(mapAliasesByName, upper(row.name), intern(row.alias))
		}
		genedb.mapByAlias = mapByAlias
		genedb.mapAliasesByName = mapAliasesByName

		genedb.getNameByAlias = {
			// replaces: select name from genealias where alias=?
			get: (alias: string) => {
				const name = firstValue(mapByAlias, alias)
				return name ? { name } : undefined
			},
			all: (alias: string) => allValues(mapByAlias, alias).map(name => ({ name }))
		}
		genedb.getAliasByName = {
			// replaces: select alias from genealias where name=?
			get: (name: string) => {
				const alias = firstValue(mapAliasesByName, name)
				return alias ? { alias } : undefined
			},
			all: (name: string) => allValues(mapAliasesByName, name).map(alias => ({ alias }))
		}
	}

	if (tables.has('gene2canonicalisoform')) {
		/** k: uppercased gene, in practice an ENSG accession, v: its canonical isoform */
		const mapCanonicalIsoformByEnsg = new Map<string, string>()
		for (const row of genedb.db
			.prepare('select gene, isoform from gene2canonicalisoform')
			.iterate() as Iterable<CanonicalIsoformRow>) {
			const geneKey = upper(row.gene)
			if (!mapCanonicalIsoformByEnsg.has(geneKey)) mapCanonicalIsoformByEnsg.set(geneKey, intern(row.isoform))
		}
		genedb.mapCanonicalIsoformByEnsg = mapCanonicalIsoformByEnsg

		genedb.get_gene2canonicalisoform = {
			// replaces: select isoform from gene2canonicalisoform where gene=?
			get: (gene: string) => {
				const isoform = typeof gene == 'string' ? mapCanonicalIsoformByEnsg.get(upper(gene)) : undefined
				return isoform ? { isoform } : undefined
			}
		}
	}

	console.log(
		`Loaded gene db lookups: ${mapByName.size} genes, ${mapByIsoform.size} isoforms, ${aliasCount} aliases,` +
			` ${genedb.mapCanonicalIsoformByEnsg?.size || 0} canonical isoforms, in ${Date.now() - t0}ms`
	)
}
