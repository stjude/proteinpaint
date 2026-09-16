import type { RouteApi, RoutePayload } from '#types'
import { xfetch } from '#src/xfetch.js'

/* PubMed articles on a gene's methylation and expression, with DOIs, for the DMR-gene links table.

NCBI E-utilities: esearch for the ids, esummary for title, journal, year and DOI. The query names the
gene and the mechanism the link is read under -- promoter or gene-body methylation -- plus
expression, so a hit is about the relationship rather than any mention of the gene. Asked one gene at
a time, on the reader's click: E-utilities allows 3 requests a second without an API key, which a
table-wide lookup would exceed at once. */

export const api: RouteApi = {
	endpoint: 'termdb/dmrLiterature',
	methods: {
		get: { init, request: { typeId: undefined }, response: { typeId: undefined } } as any as RoutePayload,
		post: { init, request: { typeId: undefined }, response: { typeId: undefined } } as any as RoutePayload
	}
}

const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
const MAX_ARTICLES = 5
/** Lookups by query, in flight or done, shared by every user of this process: concurrent clicks on one
 * gene share one pair of NCBI calls. Past MAX_MEMO the oldest query is evicted (Map keeps insertion order). */
const MAX_MEMO = 500
const memo = new Map<string, Promise<any>>()
/** E-utilities allows 3 requests a second without an API key; calls from every request are spaced by this */
const EUTILS_SPACING_MS = 350
let nextSlot = 0
/** xfetch parses JSON only on an exact 'application/json'; NCBI appends '; charset=UTF-8' */
const eutils = async (url: string) => {
	const now = Date.now()
	const wait = Math.max(0, nextSlot - now)
	nextSlot = Math.max(now, nextSlot) + EUTILS_SPACING_MS
	if (wait) await new Promise(resolve => setTimeout(resolve, wait))
	const r = await xfetch(url)
	return typeof r == 'string' ? JSON.parse(r) : r
}

export function literatureQuery(gene: string, context: string, disease?: string) {
	const mech = context == 'promoter' ? 'promoter[tiab]' : '("gene body"[tiab] OR intragenic[tiab])'
	return (
		`"${gene}"[tiab] AND (methylation[tiab] OR hypermethylation[tiab] OR hypomethylation[tiab]) AND ${mech} AND (expression[tiab] OR transcription[tiab] OR silencing[tiab])` +
		// without it, a well-studied gene's hits are whichever cancer studied it most
		(disease ? ` AND "${disease}"[tiab]` : '')
	)
}

async function lookup(term: string) {
	const search: any = await eutils(
		`${EUTILS}/esearch.fcgi?db=pubmed&retmode=json&sort=relevance&retmax=${MAX_ARTICLES}&term=${encodeURIComponent(
			term
		)}`
	)
	const ids: string[] = search?.esearchresult?.idlist || []
	const count = Number(search?.esearchresult?.count) || 0
	let articles: any[] = []
	if (ids.length) {
		const sum: any = await eutils(`${EUTILS}/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}`)
		articles = ids.map(id => {
			const a = sum?.result?.[id] || {}
			return {
				pmid: id,
				title: a.title,
				journal: a.source,
				year: String(a.pubdate || '').slice(0, 4),
				doi: (a.articleids || []).find((x: any) => x.idtype == 'doi')?.value || null
			}
		})
	}
	return { count, articles, query: term }
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const q = req.query
			// read so the request is gated like every termdb route (auth resolves from dslabel)
			if (!genomes[q.genome]?.datasets?.[q.dslabel]) throw new Error('unknown genome or dataset')
			// a symbol, not a query: anything else could rewrite the search
			if (typeof q.gene != 'string' || !/^[A-Za-z0-9._-]{1,40}$/.test(q.gene)) throw new Error('invalid gene')
			if (
				q.disease != null &&
				q.disease !== '' &&
				(typeof q.disease != 'string' || !/^[A-Za-z0-9 '-]{1,60}$/.test(q.disease))
			)
				throw new Error('invalid disease term')
			const term = literatureQuery(q.gene, q.context, q.disease?.trim() || undefined)
			let found = memo.get(term)
			if (!found) {
				found = lookup(term)
				memo.set(term, found)
				if (memo.size > MAX_MEMO) memo.delete(memo.keys().next().value!)
				// a failed lookup (NCBI down, rate-limited) is retried on the next click rather than remembered
				found.catch(() => {
					if (memo.get(term) === found) memo.delete(term)
				})
			}
			res.send({ status: 'ok', ...(await found) })
		} catch (e: any) {
			// E-utilities down or unreachable from this host is a missing column, not a broken panel
			res.send({ error: `PubMed lookup failed: ${e?.message || e}` })
		}
	}
}
