const common = require('../src/common')
const got = require('got')

/*
GDC graphql API

validate_variant2sample
validate_query_snvindel_byrange
validate_query_snvindel_byisoform
validate_query_genecnv
getSamples_gdcapi

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
	so in Promise.all(), the result will be recognizable which project+disease combination it comes from
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

export async function addCrosstabCount_tonodes(nodes, ds, q) {
	/* total number of samples from the first term, as in variant2samples.sunburst_ids[0]
	map, key: value/category of this term, value: number of samples
	*/
	const t1total = new Map()

	/* cross tab result for term pairs e.g. sunburst_ids[1] against [0], and [2] against [0,1] etc
	array, ele: {}
	.id0: id of first term
	.v0: value/category of first term
	.id1: id of second term
	.v1: value/category of second term
	.id2, v2: optional, if it is [2] against [0,1]
	.count: number of samples in this combination
	*/
	const crosstabL1 = [],
		crosstabL2 = []

	// temporarily record categories for each term
	// do not register list of categories in ds, as the list could be token-specific
	const id2values = new Map()

	// get total for first term
	{
		const id = ds.variant2samples.sunburst_ids[0]
		const v2c = (await ds.termdb.termid2totalsize[id].get(q)).v2count
		id2values.set(id, new Set())
		// must convert to lower case due to issue with gdc
		for (const [v, c] of v2c) {
			const s = v.toLowerCase()
			t1total.set(s, c)
			id2values.get(id).add(s)
		}
	}

	for (let i = 1; i < ds.variant2samples.sunburst_ids.length; i++) {
		// for each term from 2nd of sunburst_ids, compute crosstab with all previous terms
		const thisid = ds.variant2samples.sunburst_ids[i]
		if (!id2values.has(thisid)) id2values.set(thisid, new Set())

		const combinations = get_priorcategories(id2values, ds.variant2samples.sunburst_ids, i)
		const promises = [] // one for each combination
		for (const combination of combinations) {
			const q2 = Object.assign({ tid2value: {} }, q)
			q2.tid2value[combination.id0] = combination.v0
			if (combination.id1) q2.tid2value[combination.id1] = combination.v1
			if (combination.id2) q2.tid2value[combination.id2] = combination.v2
			q2._combination = combination
			promises.push(ds.termdb.termid2totalsize[thisid].get(q2))
		}
		const lst = await Promise.all(promises)
		for (const { v2count, combination } of lst) {
			for (const [v, c] of v2count) {
				const s = v.toLowerCase()
				id2values.get(thisid).add(s)
				const comb = Object.assign({}, combination)
				comb.count = c
				if (i == 1) {
					comb.id1 = thisid
					comb.v1 = s
					crosstabL1.push(comb)
					continue
				}
				if (i == 2) {
					comb.id2 = thisid
					comb.v2 = s
					crosstabL2.push(comb)
				}
			}
		}
	}

	// for non-root nodes that can match with a cross-tab, add total size
	for (const node of nodes) {
		if (!node.id0) continue // root

		const v0 = node.v0.toLowerCase()
		if (!node.id1) {
			// first level, not cross tab
			node.cohortsize = t1total.get(v0)
			continue
		}
		if (!node.id2) {
			// second level, use crosstabL1
			const v1 = node.v1.toLowerCase()
			const n = crosstabL1.find(i => i.v0 == v0 && i.v1 == v1)
			if (n) node.cohortsize = n.count
			continue
		}
		if (!node.id3) {
			// third level, use crosstabL2
			const v1 = node.v1.toLowerCase()
			const v2 = node.v2.toLowerCase()
			const n = crosstabL2.find(i => i.v0 == v0 && i.v1 == v1 && i.v2 == v2)
			if (n) node.cohortsize = n.count
		}
	}
}

function get_priorcategories(id2values, tidlst, i) {
	const lst = []
	for (const v0 of id2values.get(tidlst[0])) {
		if (i > 1) {
			// use 2nd term
			for (const v1 of id2values.get(tidlst[1])) {
				if (i > 2) {
					// use 3rd term
					for (const v2 of id2values.get(tidlst[2])) {
						lst.push({
							id0: tidlst[0],
							v0,
							id1: tidlst[1],
							v1,
							id2: tidlst[2],
							v2
						})
					}
				} else {
					// use first two terms
					lst.push({
						id0: tidlst[0],
						v0,
						id1: tidlst[1],
						v1
					})
				}
			}
		} else {
			// just 1st term
			lst.push({ id0: tidlst[0], v0 })
		}
	}
	return lst
}
