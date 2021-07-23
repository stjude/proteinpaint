const gdc = require('./mds3.gdc')
const variant2samples_getresult = require('./mds3.variant2samples')

/*
********************** EXPORTED
init
client_copy
get_crosstabCombinations
********************** INTERNAL
*/

export async function init(ds, genome, _servconfig) {
	if (!ds.queries) throw 'ds.queries{} missing'
	validate_termdb(ds)
	validate_variant2samples(ds)
	validate_sampleSummaries(ds)
	validate_sampleSummaries2(ds)
	validate_query_snvindel(ds)
	validate_query_genecnv(ds, genome)
	validate_ssm2canonicalisoform(ds)
	init_dictionary(ds)
}

export function client_copy(ds) {
	/* make client copy of the ds
	to be stored at genome.datasets
*/
	const ds2 = {
		isMds3: true,
		label: ds.label,
		queries: copy_queries(ds)
	}
	if (ds.sampleSummaries) {
		ds2.sampleSummaries = ds.sampleSummaries.lst
	}
	if (ds.sampleSummaries2) {
		ds2.sampleSummaries2 = { lst: ds.sampleSummaries2.lst }
	}
	if (ds.termdb) {
		ds2.termdb = {}
		if (ds.termdb.terms) {
			// if okay to expose the whole vocabulary to client?
			// if to keep vocabulary at backend
			ds2.termdb.terms = []
			for (const m of ds.termdb.terms) {
				const n = {}
				for (const k in m) {
					if (k == 'get') continue
					n[k] = m[k]
				}
				ds2.termdb.terms.push(n)
			}
		} else {
			throw 'unknown vocab source'
		}
	}
	if (ds.queries.snvindel) {
		ds2.has_skewer = true
	}
	if (ds.queries.genecnv) {
		// quick fix, to show separate label of genecnv
		ds2.has_genecnv_quickfix = true
	}
	if (ds.variant2samples) {
		ds2.variant2samples = {
			variantkey: ds.variant2samples.variantkey,
			termidlst: ds.variant2samples.termidlst,
			type_samples: ds.variant2samples.type_samples,
			type_summary: ds.variant2samples.type_summary,
			type_sunburst: ds.variant2samples.type_sunburst,
			url: ds.variant2samples.url
		}
	}
	return ds2
}

function validate_termdb(ds) {
	const tdb = ds.termdb
	if (!tdb) return
	if (tdb.terms) {
		// the need for get function is only for gdc
		for (const t of tdb.terms) {
			if (!t.id) throw 'id missing from a term'
			if (!t.fields) throw '.fields[] missing from a term'
			if (!Array.isArray(t.fields)) throw '.fields[] not an array'
		}
	} else {
		throw 'unknown source of termdb vocabulary'
	}
	tdb.getTermById = id => {
		if (tdb.terms) {
			return tdb.terms.find(i => i.id == id)
		}
		return null
	}

	if (tdb.termid2totalsize) {
		for (const tid in tdb.termid2totalsize) {
			if (!tdb.getTermById(tid)) throw 'unknown term id from termid2totalsize: ' + tid
			const t = tdb.termid2totalsize[tid]
			if (t.gdcapi) {
				// validate
			} else {
				throw 'unknown method for term totalsize: ' + tid
			}
			// add getter
			t.get = async p => {
				// p is client query parameter (set_id, parent project_id etc)
				if (t.gdcapi) {
					return gdc.get_cohortTotal(t.gdcapi, ds, p)
				}
				throw 'unknown method for term totalsize: ' + tid
			}
		}
	}
}

function validate_variant2samples(ds) {
	const vs = ds.variant2samples
	if (!vs) return
	vs.type_samples = 'samples'
	vs.type_sunburst = 'sunburst'
	vs.type_summary = 'summary'
	if (!vs.variantkey) throw '.variantkey missing from variant2samples'
	if (['ssm_id'].indexOf(vs.variantkey) == -1) throw 'invalid value of variantkey'
	if (!vs.termidlst) throw '.termidlst[] missing from variant2samples'
	if (!Array.isArray(vs.termidlst)) throw 'variant2samples.termidlst[] is not array'
	if (vs.termidlst.length == 0) throw '.termidlst[] empty array from variant2samples'
	if (!ds.termdb) throw 'ds.termdb missing when variant2samples.termidlst is in use'
	for (const id of vs.termidlst) {
		if (!ds.termdb.getTermById(id)) throw 'term not found for an id of variant2samples.termidlst: ' + id
	}
	// FIXME should be optional. when provided will show sunburst chart
	if (!vs.sunburst_ids) throw '.sunburst_ids[] missing from variant2samples'
	if (!Array.isArray(vs.sunburst_ids)) throw '.sunburst_ids[] not array from variant2samples'
	if (vs.sunburst_ids.length == 0) throw '.sunburst_ids[] empty array from variant2samples'
	for (const id of vs.sunburst_ids) {
		if (!ds.termdb.getTermById(id)) throw 'term not found for an id of variant2samples.sunburst_ids: ' + id
	}
	if (vs.gdcapi) {
		gdc.validate_variant2sample(vs.gdcapi)
	} else {
		throw 'unknown query method of variant2samples'
	}
	vs.get = async q => {
		return await variant2samples_getresult(q, ds)
	}
	if (ds.termdb.termid2totalsize) {
		// has ways of querying total size, add the crosstab getter
		vs.addCrosstabCount = async (nodes, q) => {
			const combinations = await get_crosstabCombinations(vs.sunburst_ids, ds, q, nodes)
			if (vs.gdcapi) {
				await gdc.addCrosstabCount_tonodes(nodes, combinations)
			} else {
				throw 'unknown way of doing crosstab'
			}
		}
	}
	if (vs.url) {
		if (!vs.url.base) throw '.variant2samples.url.base missing'

		if (vs.sample_id_key) {
			// has a way to get sample name
		} else if (vs.sample_id_getter) {
			if (typeof vs.sample_id_getter != 'function') throw '.sample_id_getter is not function'
			// has a way to get sample name
		} else {
			throw 'both .sample_id_key and .sample_id_getter are missing while .variant2samples.url is used'
		}
	}
}

function copy_queries(ds) {
	const copy = {}
	if (ds.queries.snvindel) {
		copy.snvindel = {
			forTrack: ds.queries.snvindel.forTrack,
			url: ds.queries.snvindel.url
		}
		if (ds.queries.snvindel.m2csq) {
			copy.snvindel.m2csq = { by: ds.queries.snvindel.m2csq.by }
		}
	}
	if (ds.queries.genecnv) {
		copy.genecnv = {
			gaincolor: ds.queries.genecnv.gaincolor,
			losscolor: ds.queries.genecnv.losscolor
		}
	}
	// new query
	return copy
}

function validate_sampleSummaries2(ds) {
	const ss = ds.sampleSummaries2
	if (!ss) return
	if (!ds.termdb) throw 'ds.termdb missing while sampleSummary2 is in use'
	if (!ss.lst) throw '.lst missing from sampleSummaries2'
	if (!Array.isArray(ss.lst)) throw '.lst is not array from sampleSummaries2'
	for (const i of ss.lst) {
		if (!i.label1) throw '.label1 from one of sampleSummaries2.lst'
		if (!ds.termdb.getTermById(i.label1)) throw 'no term match with .label1: ' + i.label1
		if (i.label2) {
			if (!ds.termdb.getTermById(i.label2)) throw 'no term match with .label2: ' + i.label2
		}
	}
	if (!ss.get_number) throw '.get_number{} missing from sampleSummaries2'
	if (ss.get_number.gdcapi) {
		gdc.validate_sampleSummaries2_number(ss.get_number)
	} else {
		throw 'unknown query method for sampleSummaries2.get_number'
	}
	if (!ss.get_mclassdetail) throw '.get_mclassdetail{} missing from sampleSummaries2'
	if (ss.get_mclassdetail.gdcapi) {
		gdc.validate_sampleSummaries2_mclassdetail(ss.get_mclassdetail, ds)
	} else {
		throw 'unknown query method for sampleSummaries2.get_mclassdetail'
	}
}

function validate_sampleSummaries(ds) {
	const ss = ds.sampleSummaries
	if (!ss) return

	if (!ds.termdb) throw 'ds.termdb missing while sampleSummary is in use'
	if (!ss.lst) throw '.lst missing from sampleSummaries'
	if (!Array.isArray(ss.lst)) throw '.lst is not array from sampleSummaries'
	for (const i of ss.lst) {
		if (!i.label1) throw '.label1 from one of sampleSummaries.lst'
		if (!ds.termdb.getTermById(i.label1)) throw 'no term match with .label1: ' + i.label1
		if (i.label2) {
			if (!ds.termdb.getTermById(i.label2)) throw 'no term match with .label2: ' + i.label2
		}
	}
	ss.makeholder = opts => {
		const labels = new Map()
		/*
		k: label1 of .lst[]
		v: Map
		   k: label1 value
		   v: {}
			  .sampleset: Set of sample_id
		      .mclasses: Map
		         k: mclass
			     v: Set of sample id
		      .label2: Map
		         k: label2 value
			     v: {}
				    .sampleset: Set of sample id
					.mclasses: Map
			           k: mclass
				       v: Set of sample_id
		*/
		for (const i of ss.lst) {
			labels.set(i.label1, new Map())
		}
		return labels
	}
	ss.summarize = (labels, opts, datalst) => {
		// each element in datalst represent raw result from one of ds.queries{}
		// as there can be variable number of queries, the datalst[] is variable
		for (const mlst of datalst) {
			for (const m of mlst) {
				if (!m.samples) continue
				for (const sample of m.samples) {
					if (sample.sample_id == undefined) continue
					for (const i of ss.lst) {
						const v1 = sample[i.label1]
						if (v1 == undefined) continue
						const L1 = labels.get(i.label1)
						if (!L1.has(v1)) {
							const o = {
								mclasses: new Map(),
								sampleset: new Set()
							}
							if (i.label2) {
								o.label2 = new Map()
							}
							L1.set(v1, o)
						}
						L1.get(v1).sampleset.add(sample.sample_id)
						if (!L1.get(v1).mclasses.has(m.class)) L1.get(v1).mclasses.set(m.class, new Set())
						L1.get(v1)
							.mclasses.get(m.class)
							.add(sample.sample_id)
						if (i.label2) {
							const v2 = sample[i.label2]
							if (v2 == undefined) continue
							if (!L1.get(v1).label2.has(v2)) L1.get(v1).label2.set(v2, { mclasses: new Map(), sampleset: new Set() })
							const L2 = L1.get(v1).label2.get(v2)
							L2.sampleset.add(sample.sample_id)
							if (!L2.mclasses.has(m.class)) L2.mclasses.set(m.class, new Set())
							L2.mclasses.get(m.class).add(sample.sample_id)
						}
					}
				}
			}
		}
	}
	ss.finalize = async (labels, opts) => {
		// convert one "labels" map to list
		const out = []
		for (const [label1, L1] of labels) {
			let combinations
			if (ds.termdb.termid2totalsize) {
				const lev = ss.lst.find(i => i.label1 == label1)
				if (lev) {
					// should always be found
					const terms = [lev.label1]
					if (lev.label2) terms.push(lev.label2)
					combinations = await get_crosstabCombinations(terms, ds, opts)
				}
			}
			const strat = {
				label: label1,
				items: []
			}
			for (const [v1, o] of L1) {
				const L1o = {
					label: v1,
					samplecount: o.sampleset.size,
					mclasses: sort_mclass(o.mclasses)
				}
				// add cohort size, fix it so it can be applied to sub levels
				if (combinations) {
					const k = v1.toLowerCase()
					const n = combinations.find(i => i.id1 == undefined && i.v0 == k)
					if (n) L1o.cohortsize = n.count
				}

				strat.items.push(L1o)
				if (o.label2) {
					L1o.label2 = []
					for (const [v2, oo] of o.label2) {
						const L2o = {
							label: v2,
							samplecount: oo.sampleset.size,
							mclasses: sort_mclass(oo.mclasses)
						}
						if (combinations) {
							const j = v1.toLowerCase()
							const k = v2.toLowerCase()
							const n = combinations.find(i => i.v0 == j && i.v1 == k)
							if (n) L2o.cohortsize = n.count
						}
						L1o.label2.push(L2o)
					}
					L1o.label2.sort((i, j) => j.samplecount - i.samplecount)
				}
			}
			strat.items.sort((i, j) => j.samplecount - i.samplecount)
			out.push(strat)
		}
		return out
	}
	ss.mergeShowTotal = (totalcount, showcount, q) => {
		// not in use
		const out = []
		for (const [label1, L1] of showcount) {
			const strat = {
				label: label1,
				items: []
			}
			for (const [v1, o] of L1) {
				const L1o = {
					label: v1,
					samplecount: o.sampleset.size,
					mclasses: sort_mclass(o.mclasses)
				}
				// add cohort size, fix it so it can be applied to sub levels
				if (
					ds.onetimequery_projectsize &&
					ds.onetimequery_projectsize.results &&
					ds.onetimequery_projectsize.results.has(v1)
				) {
					L1o.cohortsize = ds.onetimequery_projectsize.results.get(v1)
				}

				const totalL1o = totalcount.get(label1).get(v1)
				const hiddenmclasses = []
				for (const [mclass, totalsize] of sort_mclass(totalL1o.mclasses)) {
					const show = L1o.mclasses.find(i => i[0] == mclass)
					if (!show) {
						hiddenmclasses.push([mclass, totalsize])
					} else if (totalsize > show[1]) {
						hiddenmclasses.push([mclass, totalsize - show[1]])
					}
				}
				if (hiddenmclasses.length) L1o.hiddenmclasses = hiddenmclasses

				strat.items.push(L1o)

				if (o.label2) {
					L1o.label2 = []
					for (const [v2, oo] of o.label2) {
						const L2o = {
							label: v2,
							samplecount: oo.sampleset.size,
							mclasses: sort_mclass(oo.mclasses)
						}
						const totalL2o = totalcount
							.get(label1)
							.get(v1)
							.label2.get(v2)
						const hiddenmclasses = []
						for (const [mclass, totalsize] of sort_mclass(totalL2o.mclasses)) {
							const show = L2o.mclasses.find(i => i[0] == mclass)
							if (!show) {
								hiddenmclasses.push([mclass, totalsize])
							} else if (totalsize > show[1]) {
								hiddenmclasses.push([mclass, totalsize - show[1]])
							}
						}
						if (hiddenmclasses.length) L2o.hiddenmclasses = hiddenmclasses
						L1o.label2.push(L2o)
					}
					L1o.label2.sort((i, j) => j.samplecount - i.samplecount)
				}
			}
			strat.items.sort((i, j) => j.samplecount - i.samplecount)

			// finished all show items in L1
			// for every total item in L1, see if it's missing from show L1
			for (const [v1, o] of totalcount.get(label1)) {
				if (!L1.has(v1)) {
					// v1 missing in showcount L1
					const L1o = {
						label: v1,
						samplecount: o.sampleset.size,
						hiddenmclasses: sort_mclass(o.mclasses)
					}
					strat.items.push(L1o)
				}
			}

			out.push(strat)
		}
		for (const [label1, L1] of totalcount) {
		}
		return out
	}
}

function sort_mclass(set) {
	const lst = []
	for (const [c, s] of set) {
		lst.push([c, s.size])
	}
	lst.sort((i, j) => j[1] - i[1])
	return lst
}

function validate_query_snvindel(ds) {
	const q = ds.queries.snvindel
	if (!q) return
	if (q.url) {
		if (!q.url.base) throw '.snvindel.url.base missing'
		if (!q.url.key) throw '.snvindel.url.key missing'
	}
	if (!q.byrange) throw '.byrange missing for queries.snvindel'
	if (q.byrange.gdcapi) {
		gdc.validate_query_snvindel_byrange(ds)
	} else {
		throw 'unknown query method for queries.snvindel.byrange'
	}

	if (!q.byisoform) throw '.byisoform missing for queries.snvindel'
	if (q.byisoform.gdcapi) {
		//gdc.validate_query_snvindel_byisoform(ds) // tandem rest apis
		gdc.validate_query_snvindel_byisoform_2(ds)
	} else {
		throw 'unknown query method for queries.snvindel.byisoform'
	}

	if (q.m2csq) {
		if (!q.m2csq.by) throw '.by missing from queries.snvindel.m2csq'
		if (q.m2csq.by != 'ssm_id') throw 'unknown value of queries.snvindel.m2csq.by' // add additional
		if (q.m2csq.gdcapi) {
			gdc.validate_m2csq(ds)
			// added q.m2csq.get()
		} else {
			throw 'unknown query method for queries.snvindel.m2csq'
		}
	}
}

function validate_query_genecnv(ds, genome) {
	const q = ds.queries.genecnv
	if (!q) return
	if (!q.gaincolor) throw '.gaincolor missing for queries.genecnv'
	if (!q.losscolor) throw '.losscolor missing for queries.genecnv'
	if (!q.byisoform) throw '.byisoform missing for queries.genecnv'
	if (q.byisoform.sqlquery_isoform2gene) {
		if (!q.byisoform.sqlquery_isoform2gene.statement) throw '.statement missing from byisoform.sqlquery_isoform2gene'
		q.byisoform.sqlquery_isoform2gene.query = genome.genedb.db.prepare(q.byisoform.sqlquery_isoform2gene.statement)
	}
	if (q.byisoform.gdcapi) {
		gdc.validate_query_genecnv(ds)
	} else {
		throw 'unknown query method for queries.genecnv.byisoform'
	}
}

/*
sunburst requires an array of multiple levels [project, disease, ...], with one term at each level
to get disease total sizes per project, issue separate graphql queries on disease total with filter of project=xx for each
essentially cross-tab two terms, for sunburst
may generalize for 3 terms (3 layer sunburst)
the procedural logic of cross-tabing Project+Disease may be specific to gdc, so the code here
steps:
1. given levels of sunburst [project, disease, ..], get size of each project without filtering
2. for disease at level2, get disease size by filtering on each project
3. for level 3 term, get category size by filtering on each project-disease combination
4. apply the combination sizes to each node of sunburst
*/
export async function get_crosstabCombinations(termidlst, ds, q, nodes) {
	/*
	parameters:
	termidlst[]
	- ordered array of term ids
	- must always get category list from first term, as the list cannot be predetermined due to api and token permissions
	- currently has up to three levels
	ds{}
	q{}
	nodes[], optional
	*/

	if (termidlst.length == 0) throw 'zero terms for crosstab'
	if (termidlst.length > 3) throw 'crosstab will not work with more than 3 levels'

	// stores all combinations
	// level 1: {count, id0, v0}
	// level 2: {count, id0, v0, id1, v1}
	// level 3: {count, id0, v0, id1, v1, id2, v2}
	const combinations = []

	// temporarily record categories for each term
	// do not register list of categories in ds, as the list could be token-specific
	// k: term id
	// v: set of category labels
	// if term id is not found, it will use all categories retrieved from api queries
	const id2categories = new Map()
	id2categories.set(termidlst[0], new Set())
	if (termidlst[1]) id2categories.set(termidlst[1], new Set())
	if (termidlst[2]) id2categories.set(termidlst[2], new Set())

	let useall = true // to use all categories returned from api query
	if (nodes) {
		// only use a subset of categories existing in nodes[]
		// at kras g12d, may get a node such as:
		// {"id":"root...HCMI-CMDC...","parentId":"root...HCMI-CMDC","value":1,"name":"","id0":"project","v0":"HCMI-CMDC","id1":"disease"}
		// with v1 missing, unknown reason
		useall = false
		for (const n of nodes) {
			if (n.id0) {
				if (!n.v0) {
					continue
				}
				id2categories.get(n.id0).add(n.v0.toLowerCase())
			}
			if (n.id1 && termidlst[1]) {
				if (!n.v1) {
					// see above comments
					continue
				}
				id2categories.get(n.id1).add(n.v1.toLowerCase())
			}
			if (n.id2 && termidlst[2]) {
				if (!n.v2) {
					continue
				}
				id2categories.get(n.id2).add(n.v2.toLowerCase())
			}
		}
	}

	// get term[0] category total, not dependent on other terms
	const id0 = termidlst[0]
	{
		const v2c = (await ds.termdb.termid2totalsize[id0].get(q)).v2count
		for (const [v, count] of v2c) {
			const v0 = v.toLowerCase()
			if (useall) {
				id2categories.get(id0).add(v0)
				combinations.push({ count, id0, v0 })
			} else {
				if (id2categories.get(id0).has(v0)) {
					combinations.push({ count, id0, v0 })
				}
			}
		}
	}

	// get term[1] category total, conditional on term1
	const id1 = termidlst[1]
	if (id1) {
		const promises = []
		for (const v0 of id2categories.get(id0)) {
			const q2 = Object.assign({ tid2value: {} }, q)
			q2.tid2value[id0] = v0
			q2._combination = v0
			promises.push(ds.termdb.termid2totalsize[id1].get(q2))
		}
		const lst = await Promise.all(promises)
		for (const { v2count, combination } of lst) {
			for (const [s, count] of v2count) {
				const v1 = s.toLowerCase()
				if (useall) {
					id2categories.get(id1).add(v1)
					combinations.push({ count, id0, v0: combination, id1, v1 })
				} else {
					if (id2categories.get(id1).has(v1)) {
						combinations.push({ count, id0, v0: combination, id1, v1 })
					}
				}
			}
		}
	}

	// get term[2] category total, conditional on term1+term2 combinations
	const id2 = termidlst[2]
	if (id2) {
		const promises = []
		for (const v0 of id2categories.get(id0)) {
			for (const v1 of id2categories.get(id1)) {
				const q2 = Object.assign({ tid2value: {} }, q)
				q2.tid2value[id0] = v0
				q2.tid2value[id1] = v1
				q2._combination = { v0, v1 }
				promises.push(ds.termdb.termid2totalsize[id2].get(q2))
			}
		}
		const lst = await Promise.all(promises)
		for (const { v2count, combination } of lst) {
			for (const [s, count] of v2count) {
				const v2 = s.toLowerCase()
				if (useall) {
					id2categories.get(id2).add(v2)
					combinations.push({ count, id0, v0: combination.v0, id1, v1: combination.v1, id2, v2 })
				} else {
					if (id2categories.get(id2).has(v2)) {
						combinations.push({ count, id0, v0: combination.v0, id1, v1: combination.v1, id2, v2 })
					}
				}
			}
		}
	}
	return combinations
}

function validate_ssm2canonicalisoform(ds) {
	// gdc-specific logic
	if (!ds.ssm2canonicalisoform) return
	gdc.validate_ssm2canonicalisoform(ds.ssm2canonicalisoform) // add get()
}

async function init_dictionary(ds) {
	const dictioary = ds.termdb.dictionary
	// 'ssm_occurance' dictioanry from gdc
	if (dictioary.gdcapi){
		ds.cohort = {}
		await gdc.init_dictionary(ds)
	}
}
