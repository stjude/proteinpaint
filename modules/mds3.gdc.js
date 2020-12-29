const common = require('../src/common')
const got = require('got')

/*
GDC graphql API

validate_variant2sample
validate_query_snvindel_byrange
validate_query_snvindel_byisoform
validate_query_genecnv
getSamples_gdcapi
get_cohortTotal
get_crosstabCombinations
addCrosstabCount_tonodes

getheaders
*/

export function validate_variant2sample(a) {
	if (typeof a.filters != 'function') throw '.variant2samples.gdcapi.filters() not a function'
}

export function validate_query_snvindel_byrange(a) {
	if (!a.query) throw '.query missing for byrange.gdcapi'
	if (typeof a.query != 'string') throw '.query not string in byrange.gdcapi'
	if (typeof a.variables != 'function') throw '.byrange.gdcapi.variables() not a function'
	// TODO a.get()
}

export function validate_query_snvindel_byisoform(api, ds) {
	if (!Array.isArray(api.lst)) throw 'api.lst is not array'
	if (api.lst.length != 2) throw 'api.lst is not array of length 2'
	for (const a of api.lst) {
		if (!a.endpoint) throw '.endpoint missing for byisoform.gdcapi'
		if (!a.fields) throw '.fields missing for byisoform.gdcapi'
		if (!a.filters) throw '.filters missing for byisoform.gdcapi'
		if (typeof a.filters != 'function') throw 'byisoform.gdcapi.filters() is not a function'
	}
	api.get = async opts => {
		const hits = await snvindel_byisoform_run(api, opts)
		const mlst = [] // parse snv/indels into this list
		for (const hit of hits) {
			if (!hit.ssm_id) throw 'hit.ssm_id missing'
			if (!Number.isInteger(hit.start_position)) throw 'hit.start_position is not integer'
			const m = {
				ssm_id: hit.ssm_id,
				dt: common.dtsnvindel,
				chr: hit.chromosome,
				pos: hit.start_position - 1,
				ref: hit.reference_allele,
				alt: hit.tumor_allele,
				isoform: opts.isoform,
				// occurrence count will be overwritten after sample filtering
				occurrence: hit.cases.length
			}
			snvindel_addclass(m, hit.consequence)
			m.samples = []
			for (const c of hit.cases) {
				const sample = { sample_id: c.case_id }
				if (ds.sampleSummaries) {
					// At the snvindel query, each sample obj will only carry a subset of attributes
					// as defined here, for producing sub-labels
					for (const i of ds.sampleSummaries.lst) {
						{
							const t = ds.termdb.getTermById(i.label1)
							if (t) {
								sample[i.label1] = c[t.fields[0]]
								for (let j = 1; j < t.fields.length; j++) {
									if (sample[i.label1]) sample[i.label1] = sample[i.label1][t.fields[j]]
								}
							}
						}
						if (i.label2) {
							const t = ds.termdb.getTermById(i.label2)
							if (t) {
								sample[i.label2] = c[t.fields[0]]
								for (let j = 1; j < t.fields.length; j++) {
									if (sample[i.label2]) sample[i.label2] = sample[i.label2][t.fields[j]]
								}
							}
						}
					}
				}
				m.samples.push(sample)
			}
			mlst.push(m)
		}
		return mlst
	}
}

function snvindel_addclass(m, consequence) {
	if (consequence) {
		// [ { transcript } ]
		if (consequence.transcript.consequence_type) {
			const [dt, mclass, rank] = common.vepinfo(consequence.transcript.consequence_type)
			m.class = mclass
			m.mname = consequence.transcript.aa_change // may be null!

			// hardcoded logic: { vep_impact, sift_impact, polyphen_impact, polyphen_score, sift_score}
			/*
			if (ts.transcript.annotation) {
				for (const k in ts.transcript.annotation) {
					m[k] = ts.transcript.annotation[k]
				}
			}
			*/
		}
	}

	if (!m.mname) {
		m.mname = m.ref + '>' + m.alt
	}

	if (!m.class) {
		if (common.basecolor[m.ref] && common.basecolor[m.alt]) {
			m.class = common.mclasssnv
		} else {
			if (m.ref == '-') {
				m.class = common.mclassinsertion
			} else if (m.alt == '-') {
				m.class = common.mclassdeletion
			} else {
				m.class = common.mclassmnv
			}
		}
	}
}

function getheaders(q) {
	// q is req.query{}
	const h = { 'Content-Type': 'application/json', Accept: 'application/json' }
	if (q.token) h['X-Auth-Token'] = q.token
	return h
}

async function snvindel_byisoform_run(api, opts) {
	// function may be shared
	// query is ds.queries.snvindel
	const headers = getheaders(opts)
	const p1 = got(
		api.lst[0].endpoint +
			'?size=' +
			api.lst[0].size +
			'&fields=' +
			api.lst[0].fields.join(',') +
			'&filters=' +
			encodeURIComponent(JSON.stringify(api.lst[0].filters(opts))),
		{ method: 'GET', headers }
	)
	const p2 = got(
		api.lst[1].endpoint +
			'?size=' +
			api.lst[1].size +
			'&fields=' +
			api.lst[1].fields.join(',') +
			'&filters=' +
			encodeURIComponent(JSON.stringify(api.lst[1].filters(opts))),
		{ method: 'GET', headers }
	)
	const [tmp1, tmp2] = await Promise.all([p1, p2])
	let re_ssms, re_cases
	try {
		re_ssms = JSON.parse(tmp1.body)
		re_cases = JSON.parse(tmp2.body)
	} catch (e) {
		throw 'invalid JSON returned by GDC'
	}
	if (!re_ssms.data || !re_ssms.data.hits) throw 'returned data from ssms query not .data.hits'
	if (!re_cases.data || !re_cases.data.hits) throw 'returned data from cases query not .data.hits[]'
	if (!Array.isArray(re_ssms.data.hits) || !Array.isArray(re_cases.data.hits)) throw 're.data.hits[] is not array'
	const id2ssm = new Map()
	// key: ssm_id, value: ssm {}
	for (const h of re_ssms.data.hits) {
		if (!h.ssm_id) throw 'ssm_id missing from a ssms hit'
		if (!h.consequence) throw '.consequence[] missing from a ssm'
		const consequence = h.consequence.find(i => i.transcript.transcript_id == opts.isoform)
		if (!consequence) {
			// may alert??
		}
		h.consequence = consequence // keep only info for this isoform
		h.cases = []
		id2ssm.set(h.ssm_id, h)
	}
	for (const h of re_cases.data.hits) {
		if (!h.ssm) throw '.ssm{} missing from a case'
		if (!h.ssm.ssm_id) throw '.ssm.ssm_id missing from a case'
		const ssm = id2ssm.get(h.ssm.ssm_id)
		if (!ssm) throw 'ssm_id not found in ssms query'
		if (!h.case) throw '.case{} missing from a case'
		ssm.cases.push(h.case)
	}
	return [...id2ssm.values()]
}

export function validate_query_genecnv(api, ds) {
	if (!api.query) throw '.query missing for byisoform.gdcapi'
	if (typeof api.query != 'string') throw '.query not string for byisoform.gdcapi'
	if (!api.variables) throw '.variables missing for byisoform.gdcapi'
	// validate variables
	api.get = async (opts, name) => {
		// following is project-summarized query
		// should be replaced by sample-level queries
		const variables = JSON.parse(JSON.stringify(api.variables))
		variables.caseAggsFilters.content[2].content.value = [name]
		variables.cnvGain.content[2].content.value = [name]
		variables.cnvLoss.content[2].content.value = [name]
		variables.cnvTestedByGene.content[1].content.value = [name]
		variables.cnvAll.content[2].content.value = [name]
		variables.ssmFilters.content[1].content.value = [name]
		const response = await got.post(ds.apihost, {
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query: api.query, variables })
		})
		let re
		try {
			re = JSON.parse(response.body)
		} catch (e) {
			throw 'invalid JSON from GDC'
		}
		if (!re.data || !re.data.viewer || !re.data.viewer.explore || !re.data.viewer.explore.cases)
			throw 'data structure not data.viewer.explore.cases'
		const project2total = new Map()
		for (const i of re.data.viewer.explore.cases.cnvTotal.project__project_id.buckets) {
			project2total.set(i.key, i.doc_count)
		}
		const projects = new Map()
		if (re.data.viewer.explore.cases.gain) {
			for (const i of re.data.viewer.explore.cases.gain.project__project_id.buckets) {
				projects.set(i.key, { gain: i.doc_count, loss: 0 })
			}
		}
		if (re.data.viewer.explore.cases.loss) {
			for (const i of re.data.viewer.explore.cases.loss.project__project_id.buckets) {
				if (projects.has(i.key)) {
					projects.get(i.key).loss = i.doc_count
				} else {
					projects.set(i.key, { gain: 0, loss: 0 })
				}
			}
		}
		const lst = []
		for (const [k, i] of projects) {
			if (i.gain + i.loss == 0) continue
			i.label = k
			i.total = project2total.get(k)
			lst.push(i)
		}
		lst.sort((i, j) => (j.gain + j.loss) / j.total - (i.gain + i.loss) / i.total)
		return lst
	}
}

export async function getSamples_gdcapi(q, ds) {
	if (!q.ssm_id_lst) throw 'ssm_id_lst not provided'
	const api = ds.variant2samples.gdcapi
	const response = await got(
		api.endpoint +
			'?size=' +
			api.size +
			'&fields=' +
			(q.get == 'sunburst' ? api.fields_sunburst : api.fields_list).join(',') +
			'&filters=' +
			encodeURIComponent(JSON.stringify(api.filters(q))),
		{ method: 'GET', headers: getheaders(q) }
	)
	let re
	try {
		re = JSON.parse(response.body)
	} catch (e) {
		throw 'invalid JSON from GDC for variant2samples'
	}
	if (!re.data || !re.data.hits) throw 'data structure not data.hits[]'
	if (!Array.isArray(re.data.hits)) throw 're.data.hits is not array'

	const samples = []
	for (const s of re.data.hits) {
		if (!s.case) throw '.case{} missing from a hit'
		const sample = {}
		for (const id of ds.variant2samples.termidlst) {
			const t = ds.termdb.getTermById(id)
			if (t) {
				sample[id] = s.case[t.fields[0]]
				for (let j = 1; j < t.fields.length; j++) {
					if (sample[id]) sample[id] = sample[id][t.fields[j]]
				}
			}
		}
		samples.push(sample)
	}
	return samples
}

/*
works for ds.termdb.termid2totalsize{}
q is query parameter:
.set_id
.tid2value{}, k: term id, v: category value to be added to filter
._combination
	in the cross-tab computation e.g. Project+Disease, will need to attach _combination to returned data
	so in Promise.all(), the result can be traced back to a project+disease combination
*/
export async function get_cohortTotal(api, ds, q) {
	if (!api.query) throw '.query missing for termid2totalsize'
	if (!api.filters) throw '.filters missing for termid2totalsize'
	if (typeof api.filters != 'function') throw '.filters() not function in termid2totalsize'
	const response = await got.post(ds.apihost, {
		headers: getheaders(q),
		body: JSON.stringify({ query: api.query, variables: api.filters(q) })
	})
	let re
	try {
		re = JSON.parse(response.body)
	} catch (e) {
		throw 'invalid JSON from GDC for cohortTotal'
	}
	let h = re[api.keys[0]]
	for (let i = 1; i < api.keys.length; i++) {
		h = h[api.keys[i]]
		if (!h) throw '.' + api.keys[i] + ' missing from data structure of termid2totalsize'
	}
	if (!Array.isArray(h)) throw api.keys.join('.') + ' not array'
	const v2count = new Map()
	for (const t of h) {
		if (!t.key) throw 'key missing from one bucket'
		if (!Number.isInteger(t.doc_count)) throw '.doc_count not integer for bucket: ' + t.key
		v2count.set(t.key, t.doc_count)
	}
	return { v2count, combination: q._combination }
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
		useall = false // only use a subset of categories existing in nodes[]
		for (const n of nodes) {
			if (n.id0) id2categories.get(n.id0).add(n.v0.toLowerCase())
			if (n.id1 && termidlst[1]) id2categories.get(n.id1).add(n.v1.toLowerCase())
			if (n.id2 && termidlst[2]) id2categories.get(n.id2).add(n.v2.toLowerCase())
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

export async function addCrosstabCount_tonodes(nodes, ds, q) {
	const combinations = await get_crosstabCombinations(ds.variant2samples.sunburst_ids, ds, q, nodes)
	for (const node of nodes) {
		if (!node.id0) continue // root

		const v0 = node.v0.toLowerCase()
		if (!node.id1) {
			const n = combinations.find(i => i.id1 == undefined && i.v0 == v0)
			if (n) node.cohortsize = n.count
			continue
		}
		const v1 = node.v1.toLowerCase()
		if (!node.id2) {
			// second level, use crosstabL1
			const n = combinations.find(i => i.id2 == undefined && i.v0 == v0 && i.v1 == v1)
			if (n) node.cohortsize = n.count
			continue
		}
		const v2 = node.v2.toLowerCase()
		if (!node.id3) {
			// third level, use crosstabL2
			const n = crosstabL2.find(i => i.v0 == v0 && i.v1 == v1 && i.v2 == v2)
			if (n) node.cohortsize = n.count
		}
	}
}
