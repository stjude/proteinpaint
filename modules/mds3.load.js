const app = require('../app')
const path = require('path')
const utils = require('./utils')
const variant2samples_getresult = require('./mds3.variant2samples')
const samplefilter = require('./mds3.samplefilter')

/*
method good for somatic variants, in skewer and gp queries:
1) query all data without filtering
2) generate totalcount for variant attr (mclass)
   and class breakdown for sampleSummaries
3) filter by variant/sample attr
4) generate post-filter showcount and hiddencount for variant attr
   and show/hidden class breakdown for sampleSummaries


************************* q{}
.hiddenmclass Set

************************* returned data {}
## if no data, return empty arrays, so that the presence of data.skewer indicate data has been queried

.skewer[]
	ssm, sv, fusion
	has following hardcoded attributes
	.occurrence INT
	.samples [{}]
		.sample_id
.genecnvNosample[]
 */

//const serverconfig = utils.serverconfig

module.exports = genomes => {
	return async (req, res) => {
		app.log(req)
		try {
			if (!req.query.genome) throw '.genome missing'
			const genome = genomes[req.query.genome]
			if (!genome) throw 'invalid genome'
			const q = init_q(req.query, genome)
			const ds = await get_ds(q, genome)

			const result = init_result(q, ds)

			await load_driver(q, ds, result)
			// data loaded into result{}

			res.send(result)
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

async function make_totalcount(q, ds, result) {
	// total count for variant/sample prior to filtering

	if (result.skewer) {
		const cc = new Map() // k: mclass, v: {}
		for (const m of result.skewer) {
			cc.set(m.class, 1 + (cc.get(m.class) || 0))
		}
		result.mclass2variantcount = [...cc].sort((i, j) => j[1] - i[1])
		// should include cnv segment data here
		// ??? if to include genecnv data here?
	}

	if (q.samplesummary && ds.sampleSummaries) {
		const labels = ds.sampleSummaries.makeholder(q)
		const datalst = [result.skewer]
		if (result.genecnvAtsample) datalst.push(result.genecnvAtsample)
		ds.sampleSummaries.summarize(labels, q, datalst)
		result.sampleSummaries = await ds.sampleSummaries.finalize(labels, q)
	}
}

function init_q(query, genome) {
	if (query.hiddenmclasslst) {
		query.hiddenmclass = new Set(query.hiddenmclasslst.split(','))
		delete query.hiddenmclasslst
	}
	{
		const filter = samplefilter.parsearg(query)
		if (filter) {
			query.samplefiltertemp = filter
		} else {
			delete query.samplefiltertemp
		}
	}
	return query
}

/*
in order to do sample/variant summary, data from multiple queries needs to be summarized
before querying, create the summary holder
then cumulate counts from each type of data
last, finalize results by converting Set of sample id to sample count
*/
function init_result(q, ds) {
	const result = {}
	return result
}
function finalize_result(q, ds, result) {
	if (result.skewer) {
		for (const m of result.skewer) {
			if (m.samples) {
				m.occurrence = m.samples.length
				delete m.samples
			}
		}
	}
	/*
	if (result.samplesummary_showcount && result.samplesummary_totalcount) {
		result.sampleSummaries = ds.sampleSummaries.mergeShowTotal(
			result.samplesummary_totalcount,
			result.samplesummary_showcount,
			q
		)
		delete result.samplesummary_showcount
		delete result.samplesummary_totalcount
	}
	if (result.mclass2countmap) {
		result.mclass2variantcount = []
		for (const [mclass, c] of result.mclass2countmap) {
			c.class = mclass
			c.hiddencount = c.totalcount - c.showcount
			delete c.totalcount
			result.mclass2variantcount.push(c)
		}
		delete result.mclass2countmap
		result.mclass2variantcount.sort((i, j) => j.showcount - i.showcount)
	}
	*/
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
	// what other loaders can be if not in ds.queries?

	if (q.variant2samples) {
		result.variant2samples = await variant2samples_getresult(q, ds)
		return
	}

	if (q.forTrack) {
		// to load things for block track

		if (q.skewer) {
			// get skewer data
			result.skewer = [] // for skewer track
			if (ds.queries.snvindel) {
				result.skewer.push(...(await query_snvindel(q, ds)))
			}
			if (ds.queries.svfusion) {
				result.skewer.push(...(await query_svfusion(q, ds))) // TODO
			}
			if (ds.queries.genecnv) {
				// gene-level cnv data will not be directly returned to client, only summaries
				result.genecnvNosample = await query_genecnv(q, ds)
				// TODO need api details
				//result.genecnvAtsample = ....
				// should return genecnv at sample-level, then will be combined with snvindel for summary
			}

			filter_data(q, result)
			await make_totalcount(q, ds, result)

			finalize_result(q, ds, result)
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

function filter_data(q, result) {
	// will not be needed when filters are combined into graphql query language
	if (result.skewer) {
		const newskewer = []
		for (const m of result.skewer) {
			if (q.hiddenmclass && q.hiddenmclass.has(m.class)) continue

			// filter by other variant attributes

			// filter by sample attributes
			if (q.samplefiltertemp) {
				if (!m.samples) continue
				const samples = samplefilter.run(m.samples, q.samplefiltertemp)
				if (samples.length == 0) continue
				m.samples = samples
			}
			newskewer.push(m)
		}
		result.skewer = newskewer
	}

	if (result.genecnvAtsample) {
	}
	// other sample-level data types that need filtering
}

/////////////////////// not used

function make_showcount(q, ds, result) {
	// total count for variant/sample post filtering
	if (result.skewer) {
		for (const m of result.skewer) {
			result.mclass2countmap.get(m.class).showcount++
		}
	}
	if (q.samplesummary && ds.sampleSummaries) {
		const labels = ds.sampleSummaries.makeholder(q)
		const datalst = [result.skewer]
		if (result.genecnvAtsample) datalst.push(result.genecnvAtsample)
		ds.sampleSummaries.summarize(labels, q, datalst)
		result.samplesummary_showcount = labels
	}
}
