import type { Mds3 } from '#types'

/** a kind of entry of a geneVariant term's term.genes[], which names what to query: 'gene' a gene
 * symbol, 'coord' a region. See Gene and Coord in shared/types/src/terms/geneVariant.ts */
export type GvQueryMethod = 'gene' | 'coord'

/* the kinds of term.genes[] entry that ds.mayGetGeneVariantData() can query each geneVariant
query by, keyed by query the same as termdbConfig.queries{}, where addNonDictionaryQueries() in
routes/termdb.config.ts exposes them as .methods[]. A region is an entry without a gene symbol.

Derived from the getters that getGeneMlst() in mds3.init.js calls for an entry, rather than from
the getters the dataset declares, as the two differ:
- every query takes a gene
- snvindel takes a region by byrange, which getSnvindelByTerm() queries a region by even when
  byisoform is present, as a region has no gene to map to an isoform
- svfusion takes a region by byrange, but not when byname is present too: byname matches events
  by gene name, and its events have no breakpoint positions to place in a region, so a region
  query would miss them, see getSvfusionByTerm()
- cnv takes a region, unless geneCnv is present, which getGeneMlst() queries instead of cnv and
  which takes a gene only
- itd always takes a region
- no query takes a region with snvindel.byisoform.processTwsInOneQuery, a getter that takes every
  geneVariant term of a request at once in place of the queries above (see getData() in
  termdb.matrix.ts), and is not required to take a region
*/
export function getGvQueryMethods(q: Mds3['queries']): { [query: string]: GvQueryMethod[] } {
	const methods: { [query: string]: GvQueryMethod[] } = {}
	if (!q) return methods
	const batch = !!q.snvindel?.byisoform?.processTwsInOneQuery
	const add = (query: string, takesRegion: boolean) => {
		methods[query] = takesRegion && !batch ? ['gene', 'coord'] : ['gene']
	}
	if (q.snvindel) add('snvindel', !!q.snvindel.byrange)
	if (q.svfusion) add('svfusion', !!q.svfusion.byrange && !q.svfusion.byname)
	if (q.cnv || q.geneCnv) add('cnv', !q.geneCnv)
	if (q.itd) add('itd', true)
	return methods
}
