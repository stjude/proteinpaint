import { SINGLECELL_GENE_EXPRESSION, SINGLECELL_NUMERIC_VALUE, PROTEOME_ABUNDANCE, PSEUDOBULK } from '#types'
import initBinConfig from '#shared/termdb.initbinconfig.js'
import { maySetMapParent2Children } from './termdb.matrix.js'
import { getSingleCellCellValues } from './singleCell/matrixData.ts'
import { mayLimitSamples } from './mds3.filter.js'
import { resolveTermId } from './termdb.termCollection.ts'

// TODO convert to route

export async function trigger_getDefaultBins(q, ds, res) {
	/* only works for non-dict terms declared in ds.queries{}
	NOTE using following pattern:
		1. tw.term.type identical key is used both for ds.queries{} as well as bin cache named `[type]2bins`
		2. bin cache is indexed by term.name
	CAUTION if a datatype naming in ds.queries{} cannot follow this pattern then it breaks!
	*/

	// determine if parent term annotations need to be mapped to child samples (e.g. if
	// parent term(s) present in filter)
	maySetMapParent2Children(q, ds)

	const tw = q.tw
	const lst = []
	let min = Infinity
	let max = -Infinity
	let binsCache // fine to cache bins for scrna genes, but not for cohort level data that's subject to filtering
	try {
		// resolve + freeze, not just validate: see the comment on resolveTermId() in termdb.termCollection.ts
		tw.$id = resolveTermId(tw.$id)
		if (ds.termid2sample2value?.has(tw.term.id)) {
			// term data is cached
			// use the cached data to compute bins
			const sample2value = ds.termid2sample2value.get(tw.term.id)
			const limitSamples = await mayLimitSamples(q, [...sample2value.keys()], ds)
			for (const [sample, value] of sample2value) {
				if (limitSamples && !limitSamples.has(sample)) continue
				lst.push(value)
				if (value < min) min = value
				if (value > max) max = value
			}
		} else if (tw.term.type == SINGLECELL_GENE_EXPRESSION) {
			if (!ds.queries?.singleCell?.geneExpression) throw 'term type not supported by this dataset'
			// Map, not a plain object: both levels of this cache are keyed by dataset-derived
			// values (tw.term.sample, tw.$id) with no reserved-name concerns -- a Map key is never
			// coerced through the object property system, so a value of '__proto__' is just an
			// ordinary key, unlike a plain object where it can resolve to Object.prototype.
			//
			// tw.term.sample may be a {sID, eID?} object -- deserialized fresh from JSON on every
			// request, so it's a new object identity each time even for the same logical sample. A
			// Map compares object keys by identity, not value, so using the raw object directly would
			// never hit this cache across requests and would grow it unboundedly. Normalize to the
			// same effective identifier the native getter resolves the sample to (eID || sID, see
			// validSampleId() in samplesRoute.ts -- when eID is present, expression data is read from
			// a file named by eID, not sID, so two samples sharing an sID but differing in eID are
			// different underlying data and must not share a cache entry), or the string itself for
			// callers that already pass a plain string; the data getter below still receives the
			// original tw.term.sample.
			const sampleKey = typeof tw.term.sample === 'string' ? tw.term.sample : tw.term.sample?.eID || tw.term.sample?.sID
			const sample2bins = ds.queries.singleCell.geneExpression.sample2gene2expressionBins
			if (!sample2bins.has(sampleKey)) {
				binsCache = new Map()
				sample2bins.set(sampleKey, binsCache)
			} else {
				binsCache = sample2bins.get(sampleKey)
				if (binsCache.has(tw.$id)) return res.send(binsCache.get(tw.$id))
			}
			const data = await ds.queries.singleCell.geneExpression.get(q, tw.term.sample, tw.term.gene)
			for (const cell in data) {
				const value = data[cell]
				if (value < min) min = value
				if (value > max) max = value
				lst.push(value)
			}
		} else if (tw.term.type == SINGLECELL_NUMERIC_VALUE) {
			// values come from a plot column, so they are not cached: a plot file may be reloaded
			for (const { value } of await getSingleCellCellValues(q, tw, ds)) {
				if (value < min) min = value
				if (value > max) max = value
				lst.push(value)
			}
		} else {
			const queryHandler =
				tw.term.type == PROTEOME_ABUNDANCE
					? ds.queries?.proteome
					: tw.term.type == PSEUDOBULK
					? ds.queries?.singleCell?.pseudobulk
					: ds.queries?.[tw.term.type]
			if (!queryHandler) throw `term type ${tw.term.type} not supported by this dataset`
			// this cache ignores filter, can lead to misleading result caused by different filter usage; also assumes that filter is infinite and impossible to cache
			//binsCache = ds.queries[tw.term.type][`${tw.term.type}2bins`]
			//if (binsCache[tw.term.name]) return res.send(binsCache[tw.term.name])

			if (!tw.$id) tw.$id = '_'
			const args = {
				genome: q.genome,
				dslabel: q.dslabel,
				filter: q.filter,
				filter0: q.filter0,
				terms: [tw],
				mapParent2Children: q.mapParent2Children,
				sampleTypes: q.sampleTypes,
				__abortSignal: q.__abortSignal,
				dataTypeDetails: tw.term.dataTypeDetails
			}
			const data = await queryHandler.get(args)
			const termData = data.term2sample2value.get(tw.$id)
			for (const sample in termData) {
				const value = termData[sample]
				if (value < min) min = value
				if (value > max) max = value
				lst.push(value)
			}
		}
		const binconfig = initBinConfig(lst)
		if (binsCache) binsCache.set(tw.$id, { default: binconfig, min, max })
		res.send({ default: binconfig, min, max })
	} catch (e) {
		console.log(e)
		res.send({ error: e.message || e })
	}
}
