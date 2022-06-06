const gdc = require('./mds3.gdc')
const gdcTermdb = require('./termdb.gdc')
const { variant2samples_getresult } = require('./mds3.variant2samples')

/*
********************** EXPORTED
init
client_copy
get_crosstabCombinations
********************** INTERNAL
*/

export async function init(ds, genome, _servconfig) {
	if (!ds.queries) throw 'ds.queries{} missing'
	await validate_termdb(ds)
	validate_variant2samples(ds)
	validate_query_snvindel(ds)
	validate_ssm2canonicalisoform(ds)

	may_add_refseq2ensembl(ds, genome)
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

	if (ds.termdb) {
		ds2.termdb = {}
		// if using flat list of terms, do not send terms[] to client
		// as this is official ds, and client will create vocabApi
		// to query /termdb server route with standard methods
	}
	if (ds.queries.snvindel) {
		ds2.has_skewer = true
	}
	if (ds.variant2samples) {
		const skip = ['sample_id_key', 'sample_id_getter', 'gdcapi']
		ds2.variant2samples = {}
		for (const k in ds.variant2samples) {
			if (skip.includes(k)) continue
			ds2.variant2samples[k] = ds.variant2samples[k]
		}
	}
	return ds2
}

async function validate_termdb(ds) {
	const tdb = ds.termdb
	if (!tdb) return

	////////////////////////////////////////
	// ds.cohort.termdb{} is created to be compatible with termdb.js
	ds.cohort = {}
	ds.cohort.termdb = {}

	if (tdb.dictionary) {
		if (tdb.dictionary.gdcapi) {
			await gdcTermdb.initDictionary(ds)
		} else {
			throw 'unknown method to initiate dictionary'
		}
	} else if (tdb.terms) {
		// flat list of terms
		for (const t of tdb.terms) {
			if (!t.id) throw 'id missing from a term'
			if (!t.fields) throw '.fields[] missing from a term'
			if (!Array.isArray(t.fields)) throw '.fields[] not an array'
		}
	} else {
		throw 'unknown source of termdb vocabulary'
	}

	if (tdb.termid2totalsize) {
		for (const tid in tdb.termid2totalsize) {
			if (!ds.cohort.termdb.q.termjsonByOneid(tid)) throw 'unknown term id from termid2totalsize: ' + tid
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

	if (tdb.termid2totalsize2) {
		if (tdb.termid2totalsize2.gdcapi) {
			// validate gdcapi
			const gdcapi = tdb.termid2totalsize2.gdcapi
			if (typeof gdcapi.query != 'function') throw '.query() not function in termid2totalsize2'
			if (!gdcapi.keys && !gdcapi.keys.length) throw 'termid2totalsize2 missing keys[]'
			if (typeof gdcapi.filters != 'function') throw '.filters is not in termid2totalsize2'
		} else {
			throw 'unknown method for termid2totalsize2'
		}
		// add getter
		tdb.termid2totalsize2.get = async (termidlst, entries, q) => {
			// termidlst is from clientside
			let termlst = []
			for (const termid of termidlst) {
				const term = ds.cohort.termdb.q.termjsonByOneid(termid)
				if (term)
					termlst.push({
						path: term.path.replace('case.', '').replace(/\./g, '__'),
						type: term.type
					})
			}
			if (tdb.termid2totalsize2.gdcapi) {
				const tv2counts = await gdc.get_termlst2size({ api: tdb.termid2totalsize2.gdcapi, ds, termlst, q })
				for (const termid of termidlst) {
					const term = ds.cohort.termdb.q.termjsonByOneid(termid)
					const entry = entries.find(e => e.name == term.name)
					if (term && term.type == 'categorical' && entry !== undefined) {
						const tv2count = tv2counts.get(term.id)
						for (const cat of entry.numbycategory) {
							const vtotal = tv2count.find(v => v[0].toLowerCase() == cat[0].toLowerCase())
							if (vtotal) cat.push(vtotal[1])
						}
					}
				}
			} else {
				throw 'unknown method for termid2totalsize2'
			}
			return entries
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
		if (!ds.cohort.termdb.q.termjsonByOneid(id)) throw 'term not found for an id of variant2samples.termidlst: ' + id
	}
	// FIXME should be optional. when provided will show sunburst chart
	if (!vs.sunburst_ids) throw '.sunburst_ids[] missing from variant2samples'
	if (!Array.isArray(vs.sunburst_ids)) throw '.sunburst_ids[] not array from variant2samples'
	if (vs.sunburst_ids.length == 0) throw '.sunburst_ids[] empty array from variant2samples'
	for (const id of vs.sunburst_ids) {
		if (!ds.cohort.termdb.q.termjsonByOneid(id)) throw 'term not found for an id of variant2samples.sunburst_ids: ' + id
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
	// new query
	return copy
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
		gdc.validate_query_snvindel_byisoform(ds)
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

/* if genome allows converting refseq/ensembl
add a convertor in ds to map refseq to ensembl
this is required for gdc dataset
so that gencode-annotated stuff can show under a refseq name
*/
function may_add_refseq2ensembl(ds, genome) {
	if (!genome.genedb.refseq2ensembl) return
	ds.refseq2ensembl_query = genome.genedb.db.prepare('select ensembl from refseq2ensembl where refseq=?')
}
