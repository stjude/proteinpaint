import { SINGLECELL_GENE_EXPRESSION, SINGLECELL_NUMERIC_VALUE, PROTEOME_ABUNDANCE, PSEUDOBULK } from '#types'
import initBinConfig from '#shared/termdb.initbinconfig.js'
import { maySetMapParent2Children } from './termdb.matrix.js'
import { getSingleCellCellValues } from './singleCell/matrixData.ts'
import { mayLimitSamples } from './mds3.filter.js'
import { isReservedTermId } from './termdb.termCollection.ts'

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
		if (isReservedTermId(tw.$id)) throw 'term wrapper has invalid $id'
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
			binsCache = ds.queries.singleCell.geneExpression.sample2gene2expressionBins[tw.term.sample]
			if (!binsCache) binsCache = ds.queries.singleCell.geneExpression.sample2gene2expressionBins[tw.term.sample] = {}
			else if (Object.hasOwn(binsCache, tw.$id)) return res.send(binsCache[tw.$id])
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
		// defineProperty (not binsCache[tw.$id] = value): binsCache is a persistent,
		// dataset-scoped cache shared across requests, so a $id of '__proto__' must not
		// be able to reassign its prototype for every future caller
		if (binsCache)
			Object.defineProperty(binsCache, tw.$id, {
				value: { default: binconfig, min, max },
				enumerable: true,
				configurable: true,
				writable: true
			})
		res.send({ default: binconfig, min, max })
	} catch (e) {
		console.log(e)
		res.send({ error: e.message || e })
	}
}
