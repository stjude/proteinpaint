const app = require('../app')
const path = require('path')
const utils = require('./utils')
const variant2samples_getresult = require('./mds3.variant2samples')

/*
 */

//const serverconfig = __non_webpack_require__('./serverconfig.json')

module.exports = genomes => {
	return async (req, res) => {
		app.log(req)
		try {
			if (!req.query.genome) throw '.genome missing'
			const genome = genomes[req.query.genome]
			if (!genome) throw 'invalid genome'
			const ds = await get_ds(req.query, genome)

			const result = init_result(req.query, ds)

			await load_driver(req.query, ds, result)
			// what other loaders can be if not in ds.queries?

			finalize_result(req.query, ds, result)

			res.send(result)
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

/*
in order to do sample/variant summary, data from multiple queries needs to be summarized
before querying, create the summary holder
then cumulate counts from each type of data
last, finalize results by converting Set of sample id to sample count
*/
function init_result(q, ds) {
	const result = {}
	if (q.samplesummary && ds.sampleSummaries) {
		result.temp_ss_labels = ds.sampleSummaries.makeholder(q)
	}
	return result
}
function finalize_result(q, ds, result) {
	if (result.temp_ss_labels) {
		result.sampleSummaries = ds.sampleSummaries.finalize(result.temp_ss_labels, q)
		delete result.temp_ss_labels
	}
}

async function get_ds(q, genome) {
	if (q.dslabel) {
		if (!genome.datasets) throw '.datasets{} missing from genome'
		const ds = genome.datasets[q.dslabel]
		if (!ds) throw 'invalid dslabel'
		return ds
	}
	// make a custom ds
	throw 'custom ds todo'
	const ds = {}
	return ds
}

async function load_driver(q, ds, result) {
	// various bits of data to be appended as keys to result{}

	if (q.variant2samples) {
		result.data = await variant2samples_getresult(q, ds)
		return
	}

	if (q.forTrack) {
		// to load things for block track

		if (q.skewer) {
			// get skewer data
			result.skewer = [] // for skewer track
			// gene-level cnv data will not be directly returned to client, only summaries
			let genecnvAtsample // sample level data, to find out how to query this data
			let genecnvNosample // what gdc currently does, no sample info, summary at project level
			if (ds.queries.snvindel) {
				result.skewer.push(...(await query_snvindel(q, ds)))
			}
			if (ds.queries.svfusion) {
				result.skewer.push(...(await query_svfusion(q, ds))) // TODO
			}
			if (ds.queries.genecnv) {
				result.genecnvNosample = await query_genecnv(q, ds)
				// should return genecnvAtsample, then will be combined with snvindel for summary
			}
			if (result.temp_ss_labels) {
				const datalst = [result.skewer]
				if (genecnvAtsample) datalst.push(genecnvAtsample)
				ds.sampleSummaries.summarize(result.temp_ss_labels, q, datalst)
				// for skewer data, will not return sample list for each variant
				for (const i of result.skewer) {
					delete i.samples
				}
			}
		}
		// other types of data e.g. cnvpileup
		return
	}
	// other query type

	throw 'do not know what client wants'
}

async function query_snvindel(q, ds) {
	if (q.isoform) {
		if (ds.queries.snvindel.byisoform.gdcapi) {
			return await ds.queries.snvindel.byisoform.gdcapi.get(q)
		}
		throw 'unknown query method for snvindel.byisoform'
	}
	// if isoform not provided, must be by range. could be by other things?
	if (ts.byrange.gdcapi) {
		return await ds.queries.snvindel.byrange.gdcapi.get(q)
	}
	throw 'unknown query method for snvindel.byrange'
}

async function query_genecnv(q, ds) {
	if (q.isoform) {
		if (ds.queries.genecnv.byisoform) {
			let name = q.isoform
			if (ds.queries.genecnv.byisoform.sqlquery_isoform2gene) {
				// convert isoform to gene name
				const tmp = ds.queries.genecnv.byisoform.sqlquery_isoform2gene.query.get(q.isoform)
				if (tmp && tmp.gene) {
					name = tmp.gene
				} else {
					console.log('no gene found by ' + q.isoform)
					// do not crash the query! return no data
					return
				}
			}
			if (ds.queries.genecnv.byisoform.gdcapi) {
				return await ds.queries.genecnv.byisoform.gdcapi.get(q, name)
			}
			throw 'unknown query method of ds.queries.genecnv.byisoform'
		}
		throw '.byisoform missing for genecnv query'
	}
}

async function query_svfusion(q, ds) {}
