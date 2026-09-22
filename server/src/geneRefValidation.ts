/*******************************************************************************
Early validation of the gene/isoform names a request carries, run as an app
middleware (see setAppMiddlewares() in app.middlewares.js) before any route
handler, so that a name the genome does not know never reaches a data query.

WHY HERE, AND NOT IN EACH GETTER
An unknown name must not be used to query data, neither a local file read nor a
remote api call. The getters that would consume it are scattered across routes
and, for gdc and other datasets, live outside this repo entirely (a ds file
supplies ds.queries.<type>.get), so guarding them one by one is neither complete
nor future proof. One walk of the request payload, upstream of every route,
covers all of them at once -- including routes and datasets added later.

The geneVariant data getters keep their own name->coord/isoform lookups
(mayMapGeneName2coord/mayMapGeneName2isoform in mds3.init.js). Those stay as the
inner guard for callers that do not come in over http, e.g. a ds getter.

The error names the term type and where it sat, never the offending name, so
that nothing a client made up is echoed back to it (xss). The name is logged
server-side under debugmode instead.

ADDING A TERM TYPE
Add an entry to refsByTermType{}: the label used in the error message, and a
collect() that reports the gene/isoform names the term holds. Nothing else has
to change -- the walker finds a term of that type wherever it sits in the
payload: a term wrapper, a filter tvs, a groupset group filter, a dt term's
parentTerm, etc. Candidates for later: gene dependency score, and any other
gene-keyed data type.

ADDING A KIND OF REFERENCE
Add a checker to refCheckers{} and use its key as the kind reported by a
collect(). A genomic region checker would let dnaMethylation terms be validated
here; a snp checker is possible but the lookup is not cheap enough to run on
every request, so snp terms are deliberately left out for now.

DELIBERATELY NOT COVERED
- proteomeAbundance: pannda declares custom protein names that are absent from
  the gene db and must keep working
- q.currentGeneNames[] (matrix) and the mds3 track params: still guarded by the
  mds3.init.js lookups
*******************************************************************************/

import { TermTypes } from '#types'
import { dtTermTypes } from '#shared/terms.js'
import serverconfig from './serverconfig.js'

/** the kind of thing a term points at, and how to tell whether the genome knows it */
type RefKind = 'gene' | 'isoform'

/** one gene/isoform name found in a request, with the term it came from */
type GeneRef = {
	kind: RefKind
	value: string
	/** e.g. 'geneVariant TW', 'dtTerm tvs'; reported in the error message */
	context: string
}

type TermTypeSpec = {
	/** term type as named in the error message */
	label: string
	/** report every gene/isoform name of this term; a missing/non-string name is ignored,
	 * presence is the term filler's business, not this module's */
	collect: (term: any, add: (kind: RefKind, value: any) => void) => void
	/** keys of this term that the walker must not descend into, because collect() already
	 * read them and what they hold would otherwise be reported a second time */
	skipKeys?: string[]
}

const refsByTermType: { [termType: string]: TermTypeSpec } = {
	[TermTypes.GENE_VARIANT]: {
		label: 'geneVariant',
		collect: collectGeneVariant,
		/* genes[]: each entry is itself typed 'geneVariant' and is already read by
		collectGeneVariant(). childTerms[]: the dt terms derived from this term, each holding a
		parentTerm copy of it; they name no gene of their own */
		skipKeys: ['genes', 'childTerms']
	},
	[TermTypes.GENE_EXPRESSION]: { label: 'geneExpression', collect: (t, add) => add('gene', t.gene) },
	[TermTypes.ISOFORM_EXPRESSION]: { label: 'isoformExpression', collect: (t, add) => add('isoform', t.isoform) },
	[TermTypes.PSEUDOBULK]: { label: 'pseudobulk', collect: (t, add) => add('gene', t.gene) },
	[TermTypes.SINGLECELL_GENE_EXPRESSION]: {
		label: 'singleCellGeneExpression',
		collect: (t, add) => add('gene', t.gene)
	}
}

const refCheckers: { [kind in RefKind]: (genome: any, value: string) => boolean } = {
	gene: isKnownGeneName,
	isoform: isKnownIsoform
}

/* endpoints that carry term objects but do not query data with them. a saved session is
serialized state, not a query: a stale name in it must fail when a plot requests data, not
when the session is written or read back. Matched on the endpoint rather than the whole
path, which carries serverconfig.basepath when one is set */
const skippedEndpoints = new Set(['massSession'])

/** bounds the walk of a hand-written payload; the deepest real one (a matrix request whose
 * groupset group filters hold dt term tvs) is nowhere near this */
const maxDepth = 60

/*****************************************
	middleware entry point
******************************************/

/* Returns an error message when the request names a gene/isoform the genome does not know,
undefined otherwise. Never throws: a bug in the walk must not break a request that the rest
of the server would have served, so an internal error fails open and is logged. */
export function mayValidateRequestGeneRefs(req: any, genome: any, ds: any): string | undefined {
	try {
		if (!genome?.genedb) return // nothing to validate against
		const endpoint = req.path?.split('/').filter(Boolean).pop()
		if (endpoint && skippedEndpoints.has(endpoint)) return
		const refs = collectGeneRefs(req.query, getSkippedTermTypes(ds))
		if (!refs.length) return
		const invalidContexts = new Set<string>()
		const invalidValues: string[] = []
		// names repeat across a payload (a gene set sent as both terms and a filter); check each once
		const checked = new Map<string, boolean>()
		for (const ref of refs) {
			const key = `${ref.kind}|${ref.value}`
			let ok = checked.get(key)
			if (ok === undefined) {
				ok = refCheckers[ref.kind](genome, ref.value)
				checked.set(key, ok)
			}
			if (ok) continue
			invalidContexts.add(ref.context)
			invalidValues.push(ref.value)
		}
		if (!invalidContexts.size) return
		if (serverconfig.debugmode) {
			// the names stay out of the response, but are needed to debug a rejected request
			console.log('rejected unknown gene/isoform name(s):', [...new Set(invalidValues)].join(', '))
		}
		return `invalid gene/isoform for [${[...invalidContexts].sort().join(', ')}]`
	} catch (e) {
		console.log('gene/isoform validation skipped:', e)
		return
	}
}

/** term types a dataset exempts from validation, via
 * ds.cohort.termdb.skipGeneNameValidation = true | ['<term type>', ...].
 * A single-cell store built from a gene panel is the case this exists for: its genes are
 * declared per sample by the store itself (see listGenes() in singleCell/samplesRoute.ts)
 * and are not required to be in the genome gene db. */
function getSkippedTermTypes(ds: any): Set<string> {
	const skip = ds?.cohort?.termdb?.skipGeneNameValidation
	if (!skip) return new Set()
	if (skip === true) return new Set(Object.keys(refsByTermType))
	if (Array.isArray(skip)) return new Set(skip)
	throw 'ds.cohort.termdb.skipGeneNameValidation must be true or an array of term types'
}

/*****************************************
	collecting the names of a payload
******************************************/

/* Walk anything and report the gene/isoform names of every term found in it. Keyed on
term.type, so a term is found wherever it sits rather than at paths this module would have
to know: q.terms[], q.tw, a filter tvs, the tvs of a groupset group filter, a dt term's
parentTerm, a plot config of a saved session, ... */
export function collectGeneRefs(payload: any, skippedTermTypes: Set<string> = new Set()): GeneRef[] {
	const refs: GeneRef[] = []
	// a payload assembled in-process (rather than parsed from a request body) may share or
	// cycle through objects; visiting each once also keeps a repeated term from repeating work
	const seen = new WeakSet()
	walk(payload, false, '', 0)
	return refs

	function walk(node: any, inTvs: boolean, dtLabel: string, depth: number) {
		if (!node || typeof node != 'object' || depth > maxDepth) return
		if (Array.isArray(node)) {
			for (const v of node) walk(v, inTvs, dtLabel, depth + 1)
			return
		}
		if (seen.has(node)) return
		seen.add(node)

		const type = typeof node.type == 'string' ? node.type : ''
		const spec = refsByTermType[type]
		if (spec && !skippedTermTypes.has(type)) {
			/* a geneVariant term reached through a dt term's parentTerm is reported as the dt
			term that holds it, which is what the client actually sent */
			const context = `${dtLabel || spec.label} ${inTvs ? 'tvs' : 'TW'}`
			spec.collect(node, (kind, value) => {
				if (typeof value == 'string' && value) refs.push({ kind, value, context })
			})
		}

		const isDtTerm = dtTermTypes.has(type)
		for (const k in node) {
			if (spec?.skipKeys?.includes(k)) continue
			// everything nested under a tvs is part of that tvs, e.g. a dt term's parentTerm
			walk(node[k], inTvs || k == 'tvs', isDtTerm ? 'dtTerm' : dtLabel, depth + 1)
		}
	}
}

/* A geneVariant term names its genes in term.genes[]; a raw term straight off a url or an
old saved state has no genes[] and names one gene on the term itself. A coord entry names a
region instead of a gene and has nothing to look up here. */
function collectGeneVariant(term: any, add: (kind: RefKind, value: any) => void) {
	const genes = Array.isArray(term.genes) && term.genes.length ? term.genes : [term]
	for (const gene of genes) {
		if (!gene || typeof gene != 'object') continue
		if (gene.kind == 'coord') continue
		// kind may not be assigned yet on a raw term, so also recognize a coord entry by shape
		if (gene.chr && Number.isInteger(gene.start) && Number.isInteger(gene.stop)) continue
		add('gene', gene.gene || gene.name)
	}
}

/*****************************************
	gene db lookups
******************************************/

/* k: `${kind}|${name}`, v: whether the genome knows it. Both outcomes are cached: a client
that repeats a bad name must not repeat the db lookups either. Per genome, since the gene db
is per genome, and dropped with the genome object. */
const cacheByGenome = new WeakMap<object, Map<string, boolean>>()
/** caps the cache of a long-running server against junk names; the real gene space of a
 * genome is well under this */
const maxCacheEntries = 200000

function cached(genome: any, kind: RefKind, value: string, compute: () => boolean): boolean {
	let cache = cacheByGenome.get(genome)
	if (!cache) {
		cache = new Map()
		cacheByGenome.set(genome, cache)
	}
	const key = `${kind}|${value}`
	const hit = cache.get(key)
	if (hit !== undefined) return hit
	const result = compute()
	if (cache.size >= maxCacheEntries) cache.clear()
	cache.set(key, result)
	return result
}

/* Does the genome's gene db know this gene? Matches what the gene queries downstream accept:
symbol, isoform accession, alias (which is also how an ENSG accession resolves on hg38, and
how gdc's getter maps a symbol to ENSG), and an ENSG that only the gene2canonicalisoform
table knows. See getResult() in gene.js, which resolves the same set. */
export function isKnownGeneName(genome: any, name: string): boolean {
	return cached(genome, 'gene', name, () => {
		if (genome.genomicNameRegexp.test(name)) return false // not a name this server ever queries with
		const db = genome.genedb
		if (db.getnamebynameorisoform?.get(name, name)) return true
		if (db.getNameByAlias?.get(name)) return true
		const upper = name.toUpperCase()
		if (upper != name && db.getNameByAlias?.get(upper)) return true
		if (db.get_gene2canonicalisoform?.get(name)?.isoform) return true
		const unversioned = stripAccessionVersion(name)
		if (unversioned != name) return isKnownGeneName(genome, unversioned)
		return false
	})
}

/** Does the genome's gene db know this isoform accession? */
export function isKnownIsoform(genome: any, accession: string): boolean {
	return cached(genome, 'isoform', accession, () => {
		if (genome.genomicNameRegexp.test(accession)) return false
		const db = genome.genedb
		if (db.getnamebyisoform?.get(accession)) return true
		const unversioned = stripAccessionVersion(accession)
		if (unversioned != accession) return isKnownIsoform(genome, unversioned)
		return false
	})
}

/* ENSG00000141510.16 -> ENSG00000141510, NM_000546.6 -> NM_000546. Gene db rows carry no
version, while a client may send one. Only applied to something shaped like an accession, so
that a gene symbol ending in a number (MIR1-1, and any future symbol with a dot) is left
alone. */
function stripAccessionVersion(value: string): string {
	return /^[A-Za-z]{2,6}_?\d+\.\d+$/.test(value) ? value.replace(/\.\d+$/, '') : value
}
