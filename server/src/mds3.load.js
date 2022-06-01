const app = require('./app')
const path = require('path')
const utils = require('./utils')
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

module.exports = genomes => {
	return async (req, res) => {
		try {
			if (!req.query.genome) throw '.genome missing'
			const genome = genomes[req.query.genome]
			if (!genome) throw 'invalid genome'
			const q = init_q(req.query, genome)

			// user token may be provided from request header, the logic could be specific to gdc or another dataset
			if (req.get('x-auth-token')) {
				q.token = req.get('x-auth-token')
			}

			const ds = await get_ds(q, genome)

			may_validate_filter0(q, ds)

			const result = await load_driver(q, ds)

			res.send(result)
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

function summarize_mclass(mlst) {
	// should include cnv segment data here
	// ??? if to include genecnv data here?
	const cc = new Map() // k: mclass, v: {}
	for (const m of mlst) {
		cc.set(m.class, 1 + (cc.get(m.class) || 0))
	}
	return [...cc].sort((i, j) => j[1] - i[1])
}

function init_q(query, genome) {
	// cannot validate filter0 here as ds will be required and is not made yet
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
	if (query.rglst) query.rglst = JSON.parse(query.rglst)
	if (query.tid2value) query.tid2value = JSON.parse(query.tid2value)
	return query
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
	if (result._sampleSet) {
		result.sampleTotalNumber = result._sampleSet.size
		delete result._sampleSet
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
	// may cache index files from url, thus the await
	return ds
}

async function load_driver(q, ds) {
	// various bits of data to be appended as keys to result{}
	// what other loaders can be if not in ds.queries?

	if (q.ssm2canonicalisoform) {
		// gdc-specific logic
		if (!ds.ssm2canonicalisoform) throw 'ssm2canonicalisoform not supported on this dataset'
		return { isoform: await ds.ssm2canonicalisoform.get(q) }
	}

	if (q.variant2samples) {
		if (!ds.variant2samples) throw 'not supported by server'
		return { variant2samples: await ds.variant2samples.get(q) }
	}

	if (q.m2csq) {
		if (ds.queries && ds.queries.snvindel && ds.queries.snvindel.m2csq) {
			return { csq: await ds.queries.snvindel.m2csq.get(q) }
		}
		throw 'm2csq not supported on this dataset'
	}

	if (q.forTrack) {
		// to load things for block track
		const result = {}

		if (q.skewer) {
			// get skewer data
			result.skewer = [] // for skewer track

			if (ds.queries.snvindel) {
				// the query will resolve to list of mutations, to be flattened and pushed to .skewer[]
				const d = await query_snvindel(q, ds)
				result.skewer.push(...d)

				// quick fix
				// TODO if snvindel d contains samples, then collect samples from there
				if (ds.queries.snvindel.getSamples) {
					// running variant2sample query to retrieve total list of samples
					// since ssm returned by snvindel query does not contain samples
					// may rename to getSample_v2s to signify this
					const p = JSON.parse(JSON.stringify(q))
					p.get = ds.variant2samples.type_samplesIdOnly
					const samples = await ds.variant2samples.get(p)
					// samples is array of {sample_id}
					// later may join sample sets from snvindel and fusion together using Set

					// missing holder, init
					if (!result._sampleSet) result._sampleSet = new Set()
					// collect sample ids into the set
					for (const s of samples) result._sampleSet.add(s.sample_id)
				}
			}

			if (ds.queries.svfusion) {
				// todo
				const d = await query_svfusion(q, ds)
				result.skewer.push(...d)
				if (ds.queries.svfusion.getSamples) {
					// may duplicate same steps as snvindel.getSamples?
					if (!result._sampleSet) result._sampleSet = new Set()
					// add fusion samples to _sampleSet
				}
			}

			filter_data(q, result)

			result.mclass2variantcount = summarize_mclass(result.skewer)
		}

		// add queries for new data types

		finalize_result(q, ds, result)
		return result
	}
	// other query type

	throw 'do not know what client wants'
}

async function query_snvindel(q, ds) {
	if (q.isoform) {
		if (q.atgenomic) {
			// in genomic mode
			if (!ds.queries.snvindel.byrange) throw '.atgenomic but missing byrange query method'
			return await ds.queries.snvindel.byrange.get(q)
		}
		if (!ds.queries.snvindel.byisoform) throw 'q.isoform is given but missing byisoform query method'
		return await ds.queries.snvindel.byisoform.get(q)
	}
	// if isoform not provided, must be by range. could be by other things?
	if (ds.queries.snvindel.byrange) {
		return await ds.queries.snvindel.byrange.get(q)
	}
	throw 'unknown query method for snvindel'
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
			return await ds.queries.genecnv.byisoform.get(q, name)
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

/* may validate q.filter0
the validation function is defined in ds
cannot do it in init_q() as ds is not available
this ensures filter0 and its validation is generic and not specific to gdc
*/
function may_validate_filter0(q, ds) {
	if (q.filter0) {
		const f = JSON.parse(q.filter0)
		q.filter0 = ds.validate_filter0(f)
	}
}
