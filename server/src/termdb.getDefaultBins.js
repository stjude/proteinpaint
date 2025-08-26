import { TermTypes } from '#shared/terms.js'
import initBinConfig from '#shared/termdb.initbinconfig.js'

// TODO convert to route

export async function trigger_getDefaultBins(q, ds, res) {
	/* only works for non-dict terms declared in ds.queries{}
	NOTE using following pattern:
		1. tw.term.type identical key is used both for ds.queries{} as well as bin cache named `[type]2bins`
		2. bin cache is indexed by term.name
	CAUTION if a datatype naming in ds.queries{} cannot follow this pattern then it breaks!
	*/
	const tw = q.tw
	const lst = []
	let min = Infinity
	let max = -Infinity
	let binsCache // fine to cache bins for scrna genes, but not for cohort level data that's subject to filtering
	try {
		if (tw.term.type == TermTypes.SINGLECELL_GENE_EXPRESSION) {
			if (!ds.queries?.singleCell?.geneExpression) throw 'term type not supported by this dataset'
			binsCache = ds.queries.singleCell.geneExpression.sample2gene2expressionBins[tw.term.sample]
			if (!binsCache) binsCache = ds.queries.singleCell.geneExpression.sample2gene2expressionBins[tw.term.sample] = {}
			else if (binsCache[tw.$id]) return res.send(binsCache[tw.$id])
			const args = {
				sample: tw.term.sample,
				gene: tw.term.gene
			}
			const data = await ds.queries.singleCell.geneExpression.get(args)
			for (const cell in data) {
				const value = data[cell]
				if (value < min) min = value
				if (value > max) max = value
				lst.push(value)
			}
		} else {
			if (!ds.queries?.[tw.term.type]) throw 'term type not supported by this dataset'
			// this cache ignores filter, can lead to misleading result caused by different filter usage; also assumes that filter is infinite and impossible to cache
			//binsCache = ds.queries[tw.term.type][`${tw.term.type}2bins`]
			//if (binsCache[tw.term.name]) return res.send(binsCache[tw.term.name])

			if (!tw.$id) tw.$id = '_'
			const args = {
				genome: q.genome,
				dslabel: q.dslabel,
				filter: q.filter,
				filter0: q.filter0,
				terms: [tw]
			}
			const data = await ds.queries[tw.term.type].get(args)
			const termData = data.term2sample2value.get(tw.$id)
			for (const sample in termData) {
				const value = termData[sample]
				if (value < min) min = value
				if (value > max) max = value
				lst.push(value)
			}
		}
		const binconfig = initBinConfig(lst)
		if (binsCache) binsCache[tw.$id] = { default: binconfig, min, max }
		res.send({ default: binconfig, min, max })
	} catch (e) {
		console.log(e)
		res.send({ error: e.message || e })
	}
}
