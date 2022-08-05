const app = require('./app')
const path = require('path')
const utils = require('./utils')
const snvindelByRangeGetter_bcf = require('./mds3.init').snvindelByRangeGetter_bcf

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

export function mds3_request_closure(genomes) {
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
		// snvindel has m.class=str, svfusion has only dt=int
		const key = m.class || m.dt
		cc.set(key, 1 + (cc.get(key) || 0))
	}
	return [...cc].sort((i, j) => j[1] - i[1])
}

function init_q(query, genome) {
	// cannot validate filter0 here as ds will be required and is not made yet
	if (query.hiddenmclasslst) {
		query.hiddenmclass = new Set(query.hiddenmclasslst.split(','))
		delete query.hiddenmclasslst
	}
	if (query.rglst) query.rglst = JSON.parse(query.rglst)
	if (query.tid2value) query.tid2value = JSON.parse(query.tid2value)
	return query
}

function finalize_result(q, ds, result) {
	const sampleSet = new Set() // collects sample ids if present in data points

	if (result.skewer) {
		for (const m of result.skewer) {
			if (m.samples) {
				m.occurrence = m.samples.length
				for (const s of m.samples) {
					sampleSet.add(s.sample_id)
				}
				delete m.samples
			}
		}
	}

	if (sampleSet.size) {
		// has samples, report total number of unique samples across all data types
		result.sampleTotalNumber = sampleSet.size
	}
}

async function get_ds(q, genome) {
	if (q.dslabel) {
		// is official dataset
		if (!genome.datasets) throw '.datasets{} missing from genome'
		const ds = genome.datasets[q.dslabel]
		if (!ds) throw 'invalid dslabel'
		return ds
	}
	// for a custom dataset, a temporary ds{} obj is made for every query, based on q{}
	// may cache index files from url, thus the await
	const ds = { queries: {} }
	if (q.bcffile || q.bcfurl) {
		const [e, file, isurl] = app.fileurl({ query: { file: q.bcffile, url: q.bcfurl } })
		if (e) throw e
		const _tk = {}
		if (isurl) {
			_tk.url = file
			_tk.indexURL = q.bcfindexURL
		} else {
			_tk.file = file
		}
		ds.queries.snvindel = { byrange: { _tk } }
		ds.queries.snvindel.byrange.get = await snvindelByRangeGetter_bcf(ds, genome)
	}
	// add new file types

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
		const out = await ds.variant2samples.get(q)

		if (q.get == ds.variant2samples.type_samples && q.listSsm) {
			/*
			listSsm=true as a modifier of get=samples
			work for "List" option in case menu
			for listing all samples that have mutation in the view range
			client-side variant data are stripped of sample info
			to list samples, must re-query and collect samples

			out[] must be list of sample obj, each with .ssm_id
			*/
			const id2samples = new Map() // k: sample_id, v: { key:val, ssm_id_lst:[] }
			for (const s of out) {
				if (id2samples.has(s.sample_id)) {
					id2samples.get(s.sample_id).ssm_id_lst.push(s.ssm_id)
				} else {
					s.ssm_id_lst = [s.ssm_id]
					delete s.ssm_id
					id2samples.set(s.sample_id, s)
				}
			}
			return { variant2samples: [...id2samples.values()] }
		}

		return { variant2samples: out }
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
				const mlst = await query_snvindel(q, ds)
				/* mlst=[], each element:
				{
					ssm_id:str
					mclass
					samples:[ {sample_id}, ... ]
				}
				*/
				result.skewer.push(...mlst)
			}

			if (ds.queries.svfusion) {
				// todo
				const d = await query_svfusion(q, ds)
				result.skewer.push(...d)
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
		// client supplies isoform, see if isoform query is supported
		if (q.atgenomic) {
			// in genomic mode
			if (!ds.queries.snvindel.byrange) throw '.atgenomic but missing byrange query method'
			return await ds.queries.snvindel.byrange.get(q)
		}
		if (ds.queries.snvindel.byisoform) {
			// querying by isoform is supported
			return await ds.queries.snvindel.byisoform.get(q)
		} else {
			// querying by isoform is not supported, continue to check if can query by range
		}
	}
	// not querying by isoform;
	if (q.rglst) {
		// provided range parameter
		if (!ds.queries.snvindel.byrange) throw 'q.rglst[] provided but .byrange{} is missing'
		return await ds.queries.snvindel.byrange.get(q)
	}
	// may allow other query method (e.g. by gene name from a db table)
	throw 'insufficient query parameters for snvindel'
}

async function query_svfusion(q, ds) {
	if (q.rglst) {
		if (!ds.queries.svfusion.byrange) throw 'q.rglst provided but svfusion.byrange missing'
		return await ds.queries.svfusion.byrange.get(q)
	}
	throw 'insufficient query parameters for svfusion'
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

function filter_data(q, result) {
	// will not be needed when filters are combined into graphql query language
	if (result.skewer) {
		const newskewer = []
		for (const m of result.skewer) {
			if (q.hiddenmclass && q.hiddenmclass.has(m.class)) continue

			// filter by other variant attributes

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
